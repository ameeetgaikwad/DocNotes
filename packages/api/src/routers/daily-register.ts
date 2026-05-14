import { z } from "zod";
import { eq, and, desc, asc, gte, lte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { dailyRegisterEntries, patients, patientVisits } from "@docnotes/db";
import { isNull } from "drizzle-orm";
import {
  createDailyRegisterEntrySchema,
  updateDailyRegisterEntrySchema,
  dailyRegisterQuerySchema,
  dailyRegisterSummaryQuerySchema,
  recordPaymentSchema,
} from "@docnotes/shared";
import { protectedProcedure, router } from "../trpc.js";
import { logAudit } from "../lib/audit.js";
import { ensureVisitForDate } from "./patient-visit.js";

export const dailyRegisterRouter = router({
  list: protectedProcedure
    .input(dailyRegisterQuerySchema)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          entry: dailyRegisterEntries,
          patient: {
            id: patients.id,
            firstName: patients.firstName,
            middleName: patients.middleName,
            lastName: patients.lastName,
          },
        })
        .from(dailyRegisterEntries)
        .innerJoin(patients, eq(patients.id, dailyRegisterEntries.patientId))
        .where(
          and(
            eq(dailyRegisterEntries.providerId, ctx.session.userId),
            eq(dailyRegisterEntries.visitDate, input.visitDate),
          ),
        )
        .orderBy(asc(dailyRegisterEntries.createdAt));

      const items = rows.map((r) => ({ ...r.entry, patient: r.patient }));

      let cashTotal = 0;
      let digitalTotal = 0;
      let dueTotal = 0;
      for (const r of items) {
        const fee = Number(r.feeAmount);
        const paid = Number(r.paidAmount ?? 0);
        if (r.paymentStatus === "nil") continue;
        if (r.paymentStatus === "due") {
          // Outstanding portion is what's still unpaid.
          dueTotal += Math.max(fee - paid, 0);
          // Any partial receipt already collected counts toward cash/digital
          // for the day's totals.
          if (paid > 0) {
            if (r.paymentMode === "cash") cashTotal += paid;
            else if (r.paymentMode === "digital") digitalTotal += paid;
          }
          continue;
        }
        if (r.paymentMode === "cash") cashTotal += fee;
        else if (r.paymentMode === "digital") digitalTotal += fee;
      }

      return {
        items,
        totals: {
          cash: cashTotal,
          digital: digitalTotal,
          due: dueTotal,
          all: cashTotal + digitalTotal,
        },
      };
    }),

  summary: protectedProcedure
    .input(dailyRegisterSummaryQuerySchema)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          totalCases: sql<number>`count(*)`,
          // Receipts = everything actually received (paid in full + any partial)
          receipts: sql<string>`coalesce(sum(case when ${dailyRegisterEntries.paymentStatus} = 'paid' then ${dailyRegisterEntries.feeAmount} when ${dailyRegisterEntries.paymentStatus} = 'due' then ${dailyRegisterEntries.paidAmount} else 0 end), 0)`,
          // Outstanding = unpaid portion of 'due' entries only
          pendingDues: sql<string>`coalesce(sum(case when ${dailyRegisterEntries.paymentStatus} = 'due' then greatest(${dailyRegisterEntries.feeAmount} - ${dailyRegisterEntries.paidAmount}, 0) else 0 end), 0)`,
        })
        .from(dailyRegisterEntries)
        .where(
          and(
            eq(dailyRegisterEntries.providerId, ctx.session.userId),
            gte(dailyRegisterEntries.visitDate, input.startDate),
            lte(dailyRegisterEntries.visitDate, input.endDate),
          ),
        );

      const r = rows[0];
      return {
        totalCases: Number(r?.totalCases ?? 0),
        receipts: Number(r?.receipts ?? 0),
        pendingDues: Number(r?.pendingDues ?? 0),
      };
    }),

  pendingDuesByPatient: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: dailyRegisterEntries.id,
          visitDate: dailyRegisterEntries.visitDate,
          feeAmount: dailyRegisterEntries.feeAmount,
          paidAmount: dailyRegisterEntries.paidAmount,
          serviceType: dailyRegisterEntries.serviceType,
          feeReceivedAt: dailyRegisterEntries.feeReceivedAt,
        })
        .from(dailyRegisterEntries)
        .where(
          and(
            eq(dailyRegisterEntries.providerId, ctx.session.userId),
            eq(dailyRegisterEntries.patientId, input.patientId),
            eq(dailyRegisterEntries.paymentStatus, "due"),
          ),
        )
        .orderBy(asc(dailyRegisterEntries.visitDate));

      let total = 0;
      const items = rows.map((r) => {
        const remaining = Math.max(
          Number(r.feeAmount) - Number(r.paidAmount ?? 0),
          0,
        );
        total += remaining;
        return { ...r, remaining };
      });
      return { items, total };
    }),

  overdueDues: protectedProcedure
    .input(z.object({ days: z.number().int().min(0).max(365).default(7) }))
    .query(async ({ ctx, input }) => {
      const cutoffDays = input.days;
      const rows = await ctx.db
        .select({
          patientId: dailyRegisterEntries.patientId,
          firstName: patients.firstName,
          middleName: patients.middleName,
          lastName: patients.lastName,
          phone: patients.phone,
          oldestDueDate: sql<string>`min(${dailyRegisterEntries.visitDate})`,
          outstanding: sql<string>`coalesce(sum(greatest(${dailyRegisterEntries.feeAmount} - ${dailyRegisterEntries.paidAmount}, 0)), 0)`,
        })
        .from(dailyRegisterEntries)
        .innerJoin(patients, eq(patients.id, dailyRegisterEntries.patientId))
        .where(
          and(
            eq(dailyRegisterEntries.providerId, ctx.session.userId),
            eq(dailyRegisterEntries.paymentStatus, "due"),
          ),
        )
        .groupBy(
          dailyRegisterEntries.patientId,
          patients.firstName,
          patients.middleName,
          patients.lastName,
          patients.phone,
        )
        .having(
          sql`coalesce(sum(greatest(${dailyRegisterEntries.feeAmount} - ${dailyRegisterEntries.paidAmount}, 0)), 0) > 0 AND min(${dailyRegisterEntries.visitDate}) <= (current_date - (${cutoffDays} || ' days')::interval)`,
        )
        .orderBy(asc(sql`min(${dailyRegisterEntries.visitDate})`));

      const today = new Date();
      const todayUtc = Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate(),
      );
      return rows.map((r) => {
        const oldest = new Date(r.oldestDueDate);
        const oldestUtc = Date.UTC(
          oldest.getUTCFullYear(),
          oldest.getUTCMonth(),
          oldest.getUTCDate(),
        );
        const daysOverdue = Math.max(
          Math.floor((todayUtc - oldestUtc) / (24 * 60 * 60 * 1000)),
          0,
        );
        return {
          patientId: r.patientId,
          firstName: r.firstName,
          middleName: r.middleName,
          lastName: r.lastName,
          phone: r.phone,
          oldestDueDate: r.oldestDueDate,
          outstanding: Number(r.outstanding),
          daysOverdue,
        };
      });
    }),

  allPendingDues: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        patientId: dailyRegisterEntries.patientId,
        firstName: patients.firstName,
        middleName: patients.middleName,
        lastName: patients.lastName,
        outstanding: sql<string>`coalesce(sum(greatest(${dailyRegisterEntries.feeAmount} - ${dailyRegisterEntries.paidAmount}, 0)), 0)`,
      })
      .from(dailyRegisterEntries)
      .innerJoin(patients, eq(patients.id, dailyRegisterEntries.patientId))
      .where(
        and(
          eq(dailyRegisterEntries.providerId, ctx.session.userId),
          eq(dailyRegisterEntries.paymentStatus, "due"),
        ),
      )
      .groupBy(
        dailyRegisterEntries.patientId,
        patients.firstName,
        patients.middleName,
        patients.lastName,
      )
      .having(
        sql`coalesce(sum(greatest(${dailyRegisterEntries.feeAmount} - ${dailyRegisterEntries.paidAmount}, 0)), 0) > 0`,
      )
      .orderBy(asc(patients.lastName), asc(patients.firstName));

    return rows.map((r) => ({
      ...r,
      outstanding: Number(r.outstanding),
    }));
  }),

  recordPayment: protectedProcedure
    .input(recordPaymentSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select({
          id: dailyRegisterEntries.id,
          feeAmount: dailyRegisterEntries.feeAmount,
          paymentStatus: dailyRegisterEntries.paymentStatus,
        })
        .from(dailyRegisterEntries)
        .where(
          and(
            eq(dailyRegisterEntries.id, input.id),
            eq(dailyRegisterEntries.providerId, ctx.session.userId),
          ),
        )
        .limit(1);
      const e = existing[0];
      if (!e) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Register entry not found",
        });
      }
      if (e.paymentStatus !== "due") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only 'due' entries can have payments recorded",
        });
      }
      const fee = Number(e.feeAmount);
      const clamped = Math.min(Math.max(input.paidAmount, 0), fee);
      const [updated] = await ctx.db
        .update(dailyRegisterEntries)
        .set({
          paidAmount: clamped.toFixed(2),
          feeReceivedAt: input.feeReceivedAt ?? null,
        })
        .where(
          and(
            eq(dailyRegisterEntries.id, input.id),
            eq(dailyRegisterEntries.providerId, ctx.session.userId),
          ),
        )
        .returning();

      if (updated) {
        logAudit(ctx, {
          action: "update",
          resource: "daily_register_entry_payment",
          resourceId: updated.id,
        });
      }
      return updated ?? null;
    }),

  history: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({ visitDate: dailyRegisterEntries.visitDate })
      .from(dailyRegisterEntries)
      .where(eq(dailyRegisterEntries.providerId, ctx.session.userId))
      .groupBy(dailyRegisterEntries.visitDate)
      .orderBy(desc(dailyRegisterEntries.visitDate))
      .limit(30);
  }),

  create: protectedProcedure
    .input(createDailyRegisterEntrySchema)
    .mutation(async ({ ctx, input }) => {
      const owned = await ctx.db
        .select({ id: patients.id })
        .from(patients)
        .where(
          and(
            eq(patients.id, input.patientId),
            eq(patients.createdBy, ctx.session.userId),
          ),
        )
        .limit(1);
      if (owned.length === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Patient not found",
        });
      }

      const initialPaid = input.paymentStatus === "paid" ? input.feeAmount : 0;
      const [entry] = await ctx.db
        .insert(dailyRegisterEntries)
        .values({
          providerId: ctx.session.userId,
          visitDate: input.visitDate,
          patientId: input.patientId,
          serviceType: input.serviceType ?? null,
          feeAmount: input.feeAmount.toFixed(2),
          paidAmount: initialPaid.toFixed(2),
          paymentMode: input.paymentMode,
          paymentStatus: input.paymentStatus,
          feeReceivedAt: input.feeReceivedAt ?? null,
          diagnosis: input.diagnosis?.trim() ? input.diagnosis.trim() : null,
          notes: input.notes ?? null,
        })
        .returning();

      if (entry) {
        await ensureVisitForDate(
          ctx.db,
          ctx.session.userId,
          input.patientId,
          input.visitDate,
        );
        logAudit(ctx, {
          action: "create",
          resource: "daily_register_entry",
          resourceId: entry.id,
        });
      }

      return entry;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateDailyRegisterEntrySchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const patch: {
        serviceType?: string | null;
        feeAmount?: string;
        paymentMode?: "cash" | "digital";
        paymentStatus?: "paid" | "due" | "nil";
        feeReceivedAt?: string | null;
        diagnosis?: string | null;
        notes?: string | null;
      } = {};
      if (input.data.serviceType !== undefined)
        patch.serviceType = input.data.serviceType;
      if (input.data.feeAmount !== undefined)
        patch.feeAmount = input.data.feeAmount.toFixed(2);
      if (input.data.paymentMode !== undefined)
        patch.paymentMode = input.data.paymentMode;
      if (input.data.paymentStatus !== undefined)
        patch.paymentStatus = input.data.paymentStatus;
      if (input.data.feeReceivedAt !== undefined)
        patch.feeReceivedAt = input.data.feeReceivedAt;
      if (input.data.diagnosis !== undefined)
        patch.diagnosis = input.data.diagnosis?.trim()
          ? input.data.diagnosis.trim()
          : null;
      if (input.data.notes !== undefined) patch.notes = input.data.notes;

      const [entry] = await ctx.db
        .update(dailyRegisterEntries)
        .set(patch)
        .where(
          and(
            eq(dailyRegisterEntries.id, input.id),
            eq(dailyRegisterEntries.providerId, ctx.session.userId),
          ),
        )
        .returning();

      if (entry) {
        logAudit(ctx, {
          action: "update",
          resource: "daily_register_entry",
          resourceId: entry.id,
        });
      }

      return entry ?? null;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [entry] = await ctx.db
        .delete(dailyRegisterEntries)
        .where(
          and(
            eq(dailyRegisterEntries.id, input.id),
            eq(dailyRegisterEntries.providerId, ctx.session.userId),
          ),
        )
        .returning();

      if (entry) {
        // If this was the last register entry for the patient+date AND the
        // matching visit is still just an auto-created shell (no vitals or
        // clinical notes recorded), drop the visit so History stops showing
        // a phantom row.
        const remaining = await ctx.db
          .select({ id: dailyRegisterEntries.id })
          .from(dailyRegisterEntries)
          .where(
            and(
              eq(dailyRegisterEntries.patientId, entry.patientId),
              eq(dailyRegisterEntries.visitDate, entry.visitDate),
              eq(dailyRegisterEntries.providerId, ctx.session.userId),
            ),
          )
          .limit(1);

        if (remaining.length === 0) {
          await ctx.db
            .delete(patientVisits)
            .where(
              and(
                eq(patientVisits.patientId, entry.patientId),
                eq(patientVisits.visitDate, entry.visitDate),
                eq(patientVisits.providerId, ctx.session.userId),
                isNull(patientVisits.bpSystolic),
                isNull(patientVisits.bpDiastolic),
                isNull(patientVisits.heartRate),
                isNull(patientVisits.bslFasting),
                isNull(patientVisits.bslPostprandial),
                isNull(patientVisits.bslRandom),
                isNull(patientVisits.temperatureCelsius),
                isNull(patientVisits.weightKg),
                isNull(patientVisits.heightCm),
                isNull(patientVisits.clinicalNotes),
              ),
            );
        }

        logAudit(ctx, {
          action: "delete",
          resource: "daily_register_entry",
          resourceId: entry.id,
        });
      }

      return entry ?? null;
    }),
});

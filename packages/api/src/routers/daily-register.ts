import { z } from "zod";
import { eq, and, desc, asc, gte, lte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { dailyRegisterEntries, patients } from "@docnotes/db";
import {
  createDailyRegisterEntrySchema,
  updateDailyRegisterEntrySchema,
  dailyRegisterQuerySchema,
  dailyRegisterSummaryQuerySchema,
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
        const amount = Number(r.feeAmount);
        if (r.paymentStatus === "nil") continue;
        if (r.paymentStatus === "due") {
          dueTotal += amount;
          continue;
        }
        if (r.paymentMode === "cash") cashTotal += amount;
        else if (r.paymentMode === "digital") digitalTotal += amount;
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
          receipts: sql<string>`coalesce(sum(case when ${dailyRegisterEntries.paymentStatus} = 'paid' then ${dailyRegisterEntries.feeAmount} else 0 end), 0)`,
          pendingDues: sql<string>`coalesce(sum(case when ${dailyRegisterEntries.paymentStatus} = 'due' then ${dailyRegisterEntries.feeAmount} else 0 end), 0)`,
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

      const [entry] = await ctx.db
        .insert(dailyRegisterEntries)
        .values({
          providerId: ctx.session.userId,
          visitDate: input.visitDate,
          patientId: input.patientId,
          serviceType: input.serviceType ?? null,
          feeAmount: input.feeAmount.toFixed(2),
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
        logAudit(ctx, {
          action: "delete",
          resource: "daily_register_entry",
          resourceId: entry.id,
        });
      }

      return entry ?? null;
    }),
});

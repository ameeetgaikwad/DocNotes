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
import { ensureVisitForDate, syncEntryNotesToVisit } from "./patient-visit.js";

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
      // Join + filter by patients.isActive so the dashboard summary does
      // not count entries belonging to archived (soft-deleted) patients.
      // The Total Patients tile already excludes archived patients, so the
      // mismatch (14 active patients vs 43 cases) was confusing — Manoj
      // msg 1334. Form 25 / register exports still include archived
      // patients' entries since IT retention requires the original
      // transaction record to stay accurate.
      const rows = await ctx.db
        .select({
          totalCases: sql<number>`count(*)`,
          receipts: sql<string>`coalesce(sum(case when ${dailyRegisterEntries.paymentStatus} = 'paid' then ${dailyRegisterEntries.feeAmount} when ${dailyRegisterEntries.paymentStatus} = 'due' then ${dailyRegisterEntries.paidAmount} else 0 end), 0)`,
          pendingDues: sql<string>`coalesce(sum(case when ${dailyRegisterEntries.paymentStatus} = 'due' then greatest(${dailyRegisterEntries.feeAmount} - ${dailyRegisterEntries.paidAmount}, 0) else 0 end), 0)`,
        })
        .from(dailyRegisterEntries)
        .innerJoin(patients, eq(patients.id, dailyRegisterEntries.patientId))
        .where(
          and(
            eq(dailyRegisterEntries.providerId, ctx.session.userId),
            eq(patients.isActive, true),
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
            // Skip "fees not recorded yet" placeholders (status=due,
            // amount=0) — they're not actual outstanding balances and
            // would otherwise render as ₹0 rows on the Pending Dues
            // tab and suppress the empty state (Amit review msg 1225 P2).
            sql`${dailyRegisterEntries.feeAmount} > ${dailyRegisterEntries.paidAmount}`,
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
            // Hide archived patients from the overdue-dues report — same
            // rationale as `summary` and `allPendingDues` (Manoj msg 1334).
            eq(patients.isActive, true),
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
    // Per-entry rows so the dashboard can show the original visit date
    // alongside each due (Manoj msg 1083 #1) and pass the entry into
    // the existing EditDailyRegisterEntryDialog for fee edits (#2).
    // Aggregating by patient (the prior shape) hid both pieces.
    const rows = await ctx.db
      .select({
        id: dailyRegisterEntries.id,
        patientId: dailyRegisterEntries.patientId,
        visitDate: dailyRegisterEntries.visitDate,
        serviceType: dailyRegisterEntries.serviceType,
        feeAmount: dailyRegisterEntries.feeAmount,
        paidAmount: dailyRegisterEntries.paidAmount,
        paymentMode: dailyRegisterEntries.paymentMode,
        paymentStatus: dailyRegisterEntries.paymentStatus,
        feeReceivedAt: dailyRegisterEntries.feeReceivedAt,
        diagnosis: dailyRegisterEntries.diagnosis,
        notes: dailyRegisterEntries.notes,
        firstName: patients.firstName,
        middleName: patients.middleName,
        lastName: patients.lastName,
        responsiblePartyName: patients.responsiblePartyName,
      })
      .from(dailyRegisterEntries)
      .innerJoin(patients, eq(patients.id, dailyRegisterEntries.patientId))
      .where(
        and(
          eq(dailyRegisterEntries.providerId, ctx.session.userId),
          // Exclude archived patients' dues from the dashboard panel so it
          // mirrors the Total Patients tile (Manoj msg 1334). Entries
          // still live in the DB for IT retention.
          eq(patients.isActive, true),
          eq(dailyRegisterEntries.paymentStatus, "due"),
          sql`${dailyRegisterEntries.feeAmount} > ${dailyRegisterEntries.paidAmount}`,
        ),
      )
      .orderBy(desc(dailyRegisterEntries.visitDate));

    return rows.map((r) => ({
      ...r,
      outstanding: Math.max(
        Number(r.feeAmount ?? 0) - Number(r.paidAmount ?? 0),
        0,
      ),
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
      // Once the entry is fully settled (paidAmount >= feeAmount),
      // flip paymentStatus to "paid" so it stops showing as Due in
      // the register and stops returning from pendingDuesByPatient.
      // Use a small epsilon to be safe against decimal rounding.
      const fullyPaid = clamped + 0.005 >= fee;
      const [updated] = await ctx.db
        .update(dailyRegisterEntries)
        .set({
          paidAmount: clamped.toFixed(2),
          feeReceivedAt: input.feeReceivedAt ?? null,
          ...(fullyPaid ? { paymentStatus: "paid" as const } : {}),
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
        await syncEntryNotesToVisit(
          ctx.db,
          ctx.session.userId,
          input.patientId,
          input.visitDate,
          input.notes,
        );
        // Unified register-entry + new-patient flow (Manoj msg 917):
        // if vitals were captured alongside the entry, write them onto
        // the same-date visit row that ensureVisitForDate just created
        // or reused.
        const v = input.initialVitals;
        const hasVitals =
          v &&
          (v.weightKg != null ||
            v.bpSystolic != null ||
            v.bpDiastolic != null ||
            v.spO2Percent != null ||
            v.temperatureCelsius != null);
        if (hasVitals && v) {
          await ctx.db
            .update(patientVisits)
            .set({
              weightKg: v.weightKg ?? null,
              bpSystolic: v.bpSystolic ?? null,
              bpDiastolic: v.bpDiastolic ?? null,
              spO2Percent: v.spO2Percent ?? null,
              temperatureCelsius: v.temperatureCelsius ?? null,
            })
            .where(
              and(
                eq(patientVisits.patientId, input.patientId),
                eq(patientVisits.visitDate, input.visitDate),
                eq(patientVisits.providerId, ctx.session.userId),
              ),
            );
        }
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
      // Read current row so we can reconcile paidAmount whenever
      // feeAmount or paymentStatus changes — otherwise editing a
      // paid entry's fee leaves paidAmount stale, and toggling
      // status between paid/due/nil silently desyncs the books.
      const [current] = await ctx.db
        .select({
          feeAmount: dailyRegisterEntries.feeAmount,
          paidAmount: dailyRegisterEntries.paidAmount,
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
      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Register entry not found",
        });
      }

      const patch: {
        serviceType?: string | null;
        feeAmount?: string;
        paidAmount?: string;
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

      const nextStatus = input.data.paymentStatus ?? current.paymentStatus;
      const nextFee =
        input.data.feeAmount !== undefined
          ? input.data.feeAmount
          : Number(current.feeAmount);
      const currentPaid = Number(current.paidAmount);
      const feeChanged =
        input.data.feeAmount !== undefined &&
        Number(current.feeAmount) !== input.data.feeAmount;
      const statusChanged =
        input.data.paymentStatus !== undefined &&
        current.paymentStatus !== input.data.paymentStatus;
      if (feeChanged || statusChanged) {
        if (nextStatus === "paid") {
          patch.paidAmount = nextFee.toFixed(2);
        } else if (nextStatus === "nil") {
          patch.paidAmount = "0.00";
        } else if (statusChanged && current.paymentStatus === "paid") {
          // paid → due: the prior paidAmount equals feeAmount by the
          // "paid" invariant (see create + this branch above). The
          // doctor is correcting "I marked it paid but actually it
          // isn't" — leave outstanding == fee, not zero, else the row
          // drops out of pending-due totals/dashboards/reminders.
          patch.paidAmount = "0.00";
        } else {
          // due (continuing or from nil): cap any prior partial to fee.
          patch.paidAmount = Math.min(
            Math.max(currentPaid, 0),
            nextFee,
          ).toFixed(2);
        }
      }

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
        if (input.data.notes !== undefined) {
          await syncEntryNotesToVisit(
            ctx.db,
            ctx.session.userId,
            entry.patientId,
            entry.visitDate,
            input.data.notes,
          );
        }
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
                isNull(patientVisits.spO2Percent),
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

  // Register entries flagged as "incomplete" for the Actions Center:
  // EITHER fees still due (paidAmount < feeAmount or payment_status =
  // 'due') OR clinical notes blank. Manoj msg 1493 defined incomplete
  // as missing fees-paid AND/OR clinical-notes (not diagnosis). Sorted
  // newest-first so today's gaps appear above yesterday's, and capped
  // at 50 rows so the page stays snappy on years of history.
  incompleteVisits: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: dailyRegisterEntries.id,
        visitDate: dailyRegisterEntries.visitDate,
        feeAmount: dailyRegisterEntries.feeAmount,
        paidAmount: dailyRegisterEntries.paidAmount,
        paymentStatus: dailyRegisterEntries.paymentStatus,
        notes: dailyRegisterEntries.notes,
        diagnosis: dailyRegisterEntries.diagnosis,
        patientId: patients.id,
        firstName: patients.firstName,
        middleName: patients.middleName,
        lastName: patients.lastName,
      })
      .from(dailyRegisterEntries)
      .innerJoin(patients, eq(patients.id, dailyRegisterEntries.patientId))
      .where(
        and(
          eq(dailyRegisterEntries.providerId, ctx.session.userId),
          eq(patients.isActive, true),
          sql`(${dailyRegisterEntries.paidAmount} < ${dailyRegisterEntries.feeAmount} OR ${dailyRegisterEntries.paymentStatus} = 'due' OR ${dailyRegisterEntries.notes} IS NULL OR btrim(${dailyRegisterEntries.notes}) = '')`,
        ),
      )
      .orderBy(
        desc(dailyRegisterEntries.visitDate),
        desc(dailyRegisterEntries.createdAt),
      )
      .limit(50);

    return rows.map((r) => {
      const fee = Number(r.feeAmount);
      const paid = Number(r.paidAmount ?? 0);
      const feeOutstanding = Math.max(fee - paid, 0);
      const missingFees = feeOutstanding > 0 || r.paymentStatus === "due";
      const missingNotes = !r.notes || r.notes.trim() === "";
      return {
        id: r.id,
        visitDate: r.visitDate,
        patientId: r.patientId,
        firstName: r.firstName,
        middleName: r.middleName,
        lastName: r.lastName,
        feeOutstanding,
        missingFees,
        missingNotes,
      };
    });
  }),
});

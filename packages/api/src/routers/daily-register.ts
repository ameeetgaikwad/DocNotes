import { z } from "zod";
import { eq, and, desc, asc } from "drizzle-orm";
import { dailyRegisterEntries, patients } from "@docnotes/db";
import {
  createDailyRegisterEntrySchema,
  updateDailyRegisterEntrySchema,
  dailyRegisterQuerySchema,
} from "@docnotes/shared";
import { protectedProcedure, router } from "../trpc.js";
import { logAudit } from "../lib/audit.js";

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
      for (const r of items) {
        const amount = Number(r.feeAmount);
        if (r.paymentMode === "cash") cashTotal += amount;
        else if (r.paymentMode === "digital") digitalTotal += amount;
      }

      return {
        items,
        totals: {
          cash: cashTotal,
          digital: digitalTotal,
          all: cashTotal + digitalTotal,
        },
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
      const [entry] = await ctx.db
        .insert(dailyRegisterEntries)
        .values({
          providerId: ctx.session.userId,
          visitDate: input.visitDate,
          patientId: input.patientId,
          feeAmount: input.feeAmount.toFixed(2),
          paymentMode: input.paymentMode,
          notes: input.notes ?? null,
        })
        .returning();

      if (entry) {
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
        feeAmount?: string;
        paymentMode?: "cash" | "digital";
        notes?: string | null;
      } = {};
      if (input.data.feeAmount !== undefined)
        patch.feeAmount = input.data.feeAmount.toFixed(2);
      if (input.data.paymentMode !== undefined)
        patch.paymentMode = input.data.paymentMode;
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

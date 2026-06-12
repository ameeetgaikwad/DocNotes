import { z } from "zod";
import {
  eq,
  and,
  gte,
  lte,
  sql,
  asc,
  desc,
  isNull,
  isNotNull,
} from "drizzle-orm";
import { clinicExpenses, clinicExpenseCategories } from "@docnotes/db";
import {
  createClinicExpenseSchema,
  updateClinicExpenseSchema,
  createClinicExpenseCategorySchema,
  DEFAULT_CLINIC_EXPENSE_CATEGORIES,
} from "@docnotes/shared";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc.js";
import { logAudit } from "../lib/audit.js";

function monthRange(year: number, month: number): { from: string; to: string } {
  const fromDate = new Date(Date.UTC(year, month - 1, 1));
  const toDate = new Date(Date.UTC(year, month, 0));
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: toIso(fromDate), to: toIso(toDate) };
}

function yearRange(year: number): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export const clinicExpenseRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          year: z.number().int().min(2000).max(2100).optional(),
          month: z.number().int().min(1).max(12).optional(),
          categoryName: z.string().optional(),
          paid: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const filters = [eq(clinicExpenses.providerId, ctx.session.userId)];
      if (input?.year && input.month) {
        const r = monthRange(input.year, input.month);
        filters.push(gte(clinicExpenses.expenseDate, r.from));
        filters.push(lte(clinicExpenses.expenseDate, r.to));
      } else if (input?.year) {
        const r = yearRange(input.year);
        filters.push(gte(clinicExpenses.expenseDate, r.from));
        filters.push(lte(clinicExpenses.expenseDate, r.to));
      }
      if (input?.categoryName) {
        filters.push(eq(clinicExpenses.categoryName, input.categoryName));
      }
      if (input?.paid === true) {
        filters.push(isNotNull(clinicExpenses.paidAt));
      } else if (input?.paid === false) {
        filters.push(isNull(clinicExpenses.paidAt));
      }
      return ctx.db
        .select()
        .from(clinicExpenses)
        .where(and(...filters))
        .orderBy(
          desc(clinicExpenses.expenseDate),
          desc(clinicExpenses.createdAt),
        );
    }),

  create: protectedProcedure
    .input(createClinicExpenseSchema)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(clinicExpenses)
        .values({
          providerId: ctx.session.userId,
          amount: input.amount.toFixed(2),
          categoryName: input.categoryName.trim(),
          expenseDate: input.expenseDate,
          paidAt: input.paymentMethod ? new Date() : null,
          paymentMethod: input.paymentMethod,
          staffName: input.staffName?.trim() || null,
          note: input.note?.trim() || null,
        })
        .returning();
      if (created) {
        logAudit(ctx, {
          action: "create",
          resource: "clinic_expense",
          resourceId: created.id,
        });
      }
      return created;
    }),

  update: protectedProcedure
    .input(updateClinicExpenseSchema)
    .mutation(async ({ ctx, input }) => {
      const patch: {
        amount?: string;
        categoryName?: string;
        expenseDate?: string;
        paidAt?: Date | null;
        paymentMethod?: string | null;
        staffName?: string | null;
        note?: string | null;
      } = {};
      if (input.amount !== undefined) patch.amount = input.amount.toFixed(2);
      if (input.categoryName !== undefined)
        patch.categoryName = input.categoryName.trim();
      if (input.expenseDate !== undefined)
        patch.expenseDate = input.expenseDate;
      if (input.paymentMethod !== undefined) {
        patch.paymentMethod = input.paymentMethod;
        patch.paidAt = input.paymentMethod ? new Date() : null;
      }
      if (input.staffName !== undefined)
        patch.staffName = input.staffName?.trim() || null;
      if (input.note !== undefined) patch.note = input.note?.trim() || null;

      const [updated] = await ctx.db
        .update(clinicExpenses)
        .set(patch)
        .where(
          and(
            eq(clinicExpenses.id, input.id),
            eq(clinicExpenses.providerId, ctx.session.userId),
          ),
        )
        .returning();
      if (updated) {
        logAudit(ctx, {
          action: "update",
          resource: "clinic_expense",
          resourceId: updated.id,
        });
      }
      return updated ?? null;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(clinicExpenses)
        .where(
          and(
            eq(clinicExpenses.id, input.id),
            eq(clinicExpenses.providerId, ctx.session.userId),
          ),
        )
        .returning();
      if (deleted) {
        logAudit(ctx, {
          action: "delete",
          resource: "clinic_expense",
          resourceId: deleted.id,
        });
      }
      return deleted ?? null;
    }),

  listCategories: protectedProcedure.query(async ({ ctx }) => {
    const customs = await ctx.db
      .select()
      .from(clinicExpenseCategories)
      .where(eq(clinicExpenseCategories.providerId, ctx.session.userId))
      .orderBy(asc(clinicExpenseCategories.name));
    const defaults = DEFAULT_CLINIC_EXPENSE_CATEGORIES.map((name) => ({
      name,
      isDefault: true as const,
      id: null as string | null,
    }));
    const customSet = new Set(customs.map((c) => c.name.toLowerCase()));
    const mergedDefaults = defaults.filter(
      (d) => !customSet.has(d.name.toLowerCase()),
    );
    const customRows = customs.map((c) => ({
      name: c.name,
      isDefault: false as const,
      id: c.id,
    }));
    return [...mergedDefaults, ...customRows];
  }),

  addCustomCategory: protectedProcedure
    .input(createClinicExpenseCategorySchema)
    .mutation(async ({ ctx, input }) => {
      const name = input.name.trim();
      const lower = name.toLowerCase();
      if (
        DEFAULT_CLINIC_EXPENSE_CATEGORIES.some((d) => d.toLowerCase() === lower)
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "That category already exists as a default.",
        });
      }
      try {
        const [created] = await ctx.db
          .insert(clinicExpenseCategories)
          .values({
            providerId: ctx.session.userId,
            name,
          })
          .returning();
        if (created) {
          logAudit(ctx, {
            action: "create",
            resource: "clinic_expense_category",
            resourceId: created.id,
          });
        }
        return created;
      } catch (err) {
        const pgCode = (err as { code?: string } | undefined)?.code;
        if (pgCode === "23505") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "You already have a category with that name.",
          });
        }
        throw err;
      }
    }),

  deleteCustomCategory: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(clinicExpenseCategories)
        .where(
          and(
            eq(clinicExpenseCategories.id, input.id),
            eq(clinicExpenseCategories.providerId, ctx.session.userId),
          ),
        )
        .returning();
      if (deleted) {
        logAudit(ctx, {
          action: "delete",
          resource: "clinic_expense_category",
          resourceId: deleted.id,
        });
      }
      return deleted ?? null;
    }),

  summary: protectedProcedure
    .input(
      z.object({
        year: z.number().int().min(2000).max(2100),
        month: z.number().int().min(1).max(12).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const range = input.month
        ? monthRange(input.year, input.month)
        : yearRange(input.year);

      const rows = await ctx.db
        .select({
          categoryName: clinicExpenses.categoryName,
          total: sql<string>`COALESCE(SUM(${clinicExpenses.amount}), 0)`,
          paid: sql<string>`COALESCE(SUM(CASE WHEN ${clinicExpenses.paidAt} IS NOT NULL THEN ${clinicExpenses.amount} ELSE 0 END), 0)`,
          unpaid: sql<string>`COALESCE(SUM(CASE WHEN ${clinicExpenses.paidAt} IS NULL THEN ${clinicExpenses.amount} ELSE 0 END), 0)`,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(clinicExpenses)
        .where(
          and(
            eq(clinicExpenses.providerId, ctx.session.userId),
            gte(clinicExpenses.expenseDate, range.from),
            lte(clinicExpenses.expenseDate, range.to),
          ),
        )
        .groupBy(clinicExpenses.categoryName)
        .orderBy(desc(sql`SUM(${clinicExpenses.amount})`));

      const grand = rows.reduce(
        (acc, r) => {
          acc.total += Number(r.total);
          acc.paid += Number(r.paid);
          acc.unpaid += Number(r.unpaid);
          acc.count += r.count;
          return acc;
        },
        { total: 0, paid: 0, unpaid: 0, count: 0 },
      );

      return {
        range,
        rows: rows.map((r) => ({
          categoryName: r.categoryName,
          total: Number(r.total),
          paid: Number(r.paid),
          unpaid: Number(r.unpaid),
          count: r.count,
        })),
        grandTotal: grand.total,
        grandPaid: grand.paid,
        grandUnpaid: grand.unpaid,
        grandCount: grand.count,
      };
    }),
});

import { z } from "zod";
import { and, eq, gte, lt, isNull, asc, desc } from "drizzle-orm";
import { homeVisits } from "@docnotes/db";
import { createHomeVisitSchema, updateHomeVisitSchema } from "@docnotes/shared";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc.js";
import { logAudit } from "../lib/audit.js";

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function startOfTomorrowUtc(): Date {
  const t = startOfTodayUtc();
  return new Date(t.getTime() + 24 * 60 * 60 * 1000);
}

export const homeVisitRouter = router({
  // Today's home visits — pending (not completed) AND scheduled
  // between [start of today, start of tomorrow). Sorted by scheduled
  // time ascending so the next visit is at the top.
  listToday: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(homeVisits)
      .where(
        and(
          eq(homeVisits.providerId, ctx.session.userId),
          isNull(homeVisits.completedAt),
          gte(homeVisits.scheduledAt, startOfTodayUtc()),
          lt(homeVisits.scheduledAt, startOfTomorrowUtc()),
        ),
      )
      .orderBy(asc(homeVisits.scheduledAt));
  }),

  // Full list including completed (latest first) — used for the
  // "Show past visits" toggle in the Actions UI.
  listAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(homeVisits)
      .where(eq(homeVisits.providerId, ctx.session.userId))
      .orderBy(desc(homeVisits.scheduledAt));
  }),

  create: protectedProcedure
    .input(createHomeVisitSchema)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(homeVisits)
        .values({
          providerId: ctx.session.userId,
          patientName: input.patientName.trim(),
          scheduledAt: input.scheduledAt,
          note: input.note?.trim() || null,
        })
        .returning();
      if (created) {
        logAudit(ctx, {
          action: "create",
          resource: "home_visit",
          resourceId: created.id,
        });
      }
      return created;
    }),

  update: protectedProcedure
    .input(updateHomeVisitSchema)
    .mutation(async ({ ctx, input }) => {
      const patch: {
        patientName?: string;
        scheduledAt?: Date;
        note?: string | null;
      } = {};
      if (input.patientName !== undefined)
        patch.patientName = input.patientName.trim();
      if (input.scheduledAt !== undefined)
        patch.scheduledAt = input.scheduledAt;
      if (input.note !== undefined) patch.note = input.note?.trim() || null;

      const [updated] = await ctx.db
        .update(homeVisits)
        .set(patch)
        .where(
          and(
            eq(homeVisits.id, input.id),
            eq(homeVisits.providerId, ctx.session.userId),
          ),
        )
        .returning();
      if (updated) {
        logAudit(ctx, {
          action: "update",
          resource: "home_visit",
          resourceId: updated.id,
        });
      }
      return updated ?? null;
    }),

  markCompleted: protectedProcedure
    .input(z.object({ id: z.string().uuid(), completed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(homeVisits)
        .set({ completedAt: input.completed ? new Date() : null })
        .where(
          and(
            eq(homeVisits.id, input.id),
            eq(homeVisits.providerId, ctx.session.userId),
          ),
        )
        .returning();
      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Home visit not found",
        });
      }
      logAudit(ctx, {
        action: input.completed ? "mark_done" : "mark_open",
        resource: "home_visit",
        resourceId: updated.id,
      });
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(homeVisits)
        .where(
          and(
            eq(homeVisits.id, input.id),
            eq(homeVisits.providerId, ctx.session.userId),
          ),
        )
        .returning();
      if (deleted) {
        logAudit(ctx, {
          action: "delete",
          resource: "home_visit",
          resourceId: deleted.id,
        });
      }
      return deleted ?? null;
    }),
});

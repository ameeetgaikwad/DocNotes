import { z } from "zod";
import { and, eq, isNull, asc, desc } from "drizzle-orm";
import { customTodos } from "@docnotes/db";
import {
  createCustomTodoSchema,
  updateCustomTodoSchema,
} from "@docnotes/shared";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc.js";
import { logAudit } from "../lib/audit.js";

export const customTodoRouter = router({
  // Open to-dos — anything not marked done. Sorted by due_date asc
  // (with NULL due dates at the bottom) so the most urgent is on top.
  listOpen: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(customTodos)
      .where(
        and(
          eq(customTodos.providerId, ctx.session.userId),
          isNull(customTodos.completedAt),
        ),
      )
      .orderBy(asc(customTodos.dueDate), desc(customTodos.createdAt));
  }),

  create: protectedProcedure
    .input(createCustomTodoSchema)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(customTodos)
        .values({
          providerId: ctx.session.userId,
          text: input.text.trim(),
          dueDate: input.dueDate ?? null,
        })
        .returning();
      if (created) {
        logAudit(ctx, {
          action: "create",
          resource: "custom_todo",
          resourceId: created.id,
        });
      }
      return created;
    }),

  update: protectedProcedure
    .input(updateCustomTodoSchema)
    .mutation(async ({ ctx, input }) => {
      const patch: { text?: string; dueDate?: string | null } = {};
      if (input.text !== undefined) patch.text = input.text.trim();
      if (input.dueDate !== undefined) patch.dueDate = input.dueDate ?? null;

      const [updated] = await ctx.db
        .update(customTodos)
        .set(patch)
        .where(
          and(
            eq(customTodos.id, input.id),
            eq(customTodos.providerId, ctx.session.userId),
          ),
        )
        .returning();
      if (updated) {
        logAudit(ctx, {
          action: "update",
          resource: "custom_todo",
          resourceId: updated.id,
        });
      }
      return updated ?? null;
    }),

  markDone: protectedProcedure
    .input(z.object({ id: z.string().uuid(), done: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(customTodos)
        .set({ completedAt: input.done ? new Date() : null })
        .where(
          and(
            eq(customTodos.id, input.id),
            eq(customTodos.providerId, ctx.session.userId),
          ),
        )
        .returning();
      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "To-do not found",
        });
      }
      logAudit(ctx, {
        action: input.done ? "mark_done" : "mark_open",
        resource: "custom_todo",
        resourceId: updated.id,
      });
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(customTodos)
        .where(
          and(
            eq(customTodos.id, input.id),
            eq(customTodos.providerId, ctx.session.userId),
          ),
        )
        .returning();
      if (deleted) {
        logAudit(ctx, {
          action: "delete",
          resource: "custom_todo",
          resourceId: deleted.id,
        });
      }
      return deleted ?? null;
    }),
});

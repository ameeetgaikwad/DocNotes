import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import { purchaseItems } from "@docnotes/db";
import {
  createPurchaseItemSchema,
  updatePurchaseItemSchema,
} from "@docnotes/shared";
import { protectedProcedure, router } from "../trpc.js";
import { logAudit } from "../lib/audit.js";

export const purchaseItemRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(purchaseItems)
      .where(eq(purchaseItems.providerId, ctx.session.userId))
      .orderBy(asc(purchaseItems.isDone), asc(purchaseItems.createdAt));
  }),

  create: protectedProcedure
    .input(createPurchaseItemSchema)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(purchaseItems)
        .values({
          providerId: ctx.session.userId,
          text: input.text.trim(),
          category: input.category,
        })
        .returning();
      if (created) {
        logAudit(ctx, {
          action: "create",
          resource: "purchase_item",
          resourceId: created.id,
        });
      }
      return created;
    }),

  update: protectedProcedure
    .input(updatePurchaseItemSchema)
    .mutation(async ({ ctx, input }) => {
      const patch: {
        text?: string;
        category?: "medicine" | "injection" | "other" | "reminder";
        isDone?: boolean;
      } = {};
      if (input.text !== undefined) patch.text = input.text.trim();
      if (input.category !== undefined) patch.category = input.category;
      if (input.isDone !== undefined) patch.isDone = input.isDone;

      const [updated] = await ctx.db
        .update(purchaseItems)
        .set(patch)
        .where(
          and(
            eq(purchaseItems.id, input.id),
            eq(purchaseItems.providerId, ctx.session.userId),
          ),
        )
        .returning();
      if (updated) {
        logAudit(ctx, {
          action: "update",
          resource: "purchase_item",
          resourceId: updated.id,
        });
      }
      return updated ?? null;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(purchaseItems)
        .where(
          and(
            eq(purchaseItems.id, input.id),
            eq(purchaseItems.providerId, ctx.session.userId),
          ),
        )
        .returning();
      if (deleted) {
        logAudit(ctx, {
          action: "delete",
          resource: "purchase_item",
          resourceId: deleted.id,
        });
      }
      return deleted ?? null;
    }),
});

import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import { chemists } from "@docnotes/db";
import { upsertChemistSchema } from "@docnotes/shared";
import { protectedProcedure, router } from "../trpc.js";
import { logAudit } from "../lib/audit.js";

// Chemists / pharmacy contacts (Manoj msg 2267). Follows the same
// upsert-and-list shape as medicine dealers, hard-delete on remove
// (Manoj msg 2300 — chemists are a contact list, not medical data).
export const chemistRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(chemists)
      .where(eq(chemists.providerId, ctx.session.userId))
      .orderBy(asc(chemists.name));
  }),

  upsert: protectedProcedure
    .input(upsertChemistSchema)
    .mutation(async ({ ctx, input }) => {
      const values = {
        name: input.name.trim(),
        whatsappNumber: input.whatsappNumber.trim(),
        notes: input.notes?.trim() ? input.notes.trim() : null,
      };

      if (input.id) {
        const [updated] = await ctx.db
          .update(chemists)
          .set(values)
          .where(
            and(
              eq(chemists.id, input.id),
              eq(chemists.providerId, ctx.session.userId),
            ),
          )
          .returning();
        if (updated) {
          logAudit(ctx, {
            action: "update",
            resource: "chemist",
            resourceId: updated.id,
          });
        }
        return updated ?? null;
      }

      const [created] = await ctx.db
        .insert(chemists)
        .values({ providerId: ctx.session.userId, ...values })
        .returning();
      if (created) {
        logAudit(ctx, {
          action: "create",
          resource: "chemist",
          resourceId: created.id,
        });
      }
      return created ?? null;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(chemists)
        .where(
          and(
            eq(chemists.id, input.id),
            eq(chemists.providerId, ctx.session.userId),
          ),
        )
        .returning();
      if (deleted) {
        logAudit(ctx, {
          action: "delete",
          resource: "chemist",
          resourceId: deleted.id,
        });
      }
      return deleted ?? null;
    }),
});

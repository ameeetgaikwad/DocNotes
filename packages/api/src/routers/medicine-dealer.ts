import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import { medicineDealers } from "@docnotes/db";
import { upsertMedicineDealerSchema } from "@docnotes/shared";
import { protectedProcedure, router } from "../trpc.js";
import { logAudit } from "../lib/audit.js";

export const medicineDealerRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(medicineDealers)
      .where(eq(medicineDealers.providerId, ctx.session.userId))
      .orderBy(asc(medicineDealers.name));
  }),

  upsert: protectedProcedure
    .input(upsertMedicineDealerSchema)
    .mutation(async ({ ctx, input }) => {
      const values = {
        name: input.name.trim(),
        phone: input.phone.trim(),
        notes: input.notes?.trim() ? input.notes.trim() : null,
      };

      if (input.id) {
        const [updated] = await ctx.db
          .update(medicineDealers)
          .set(values)
          .where(
            and(
              eq(medicineDealers.id, input.id),
              eq(medicineDealers.providerId, ctx.session.userId),
            ),
          )
          .returning();
        if (updated) {
          logAudit(ctx, {
            action: "update",
            resource: "medicine_dealer",
            resourceId: updated.id,
          });
        }
        return updated ?? null;
      }

      const [created] = await ctx.db
        .insert(medicineDealers)
        .values({ providerId: ctx.session.userId, ...values })
        .returning();
      if (created) {
        logAudit(ctx, {
          action: "create",
          resource: "medicine_dealer",
          resourceId: created.id,
        });
      }
      return created ?? null;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(medicineDealers)
        .where(
          and(
            eq(medicineDealers.id, input.id),
            eq(medicineDealers.providerId, ctx.session.userId),
          ),
        )
        .returning();
      if (deleted) {
        logAudit(ctx, {
          action: "delete",
          resource: "medicine_dealer",
          resourceId: deleted.id,
        });
      }
      return deleted ?? null;
    }),
});

import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import { homeopathicMedicines } from "@docnotes/db";
import {
  createHomeopathicMedicineSchema,
  updateHomeopathicMedicineSchema,
} from "@docnotes/shared";
import { protectedProcedure, router } from "../trpc.js";
import { logAudit } from "../lib/audit.js";

export const homeopathicMedicineRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(homeopathicMedicines)
      .where(eq(homeopathicMedicines.providerId, ctx.session.userId))
      .orderBy(
        asc(homeopathicMedicines.name),
        asc(homeopathicMedicines.potency),
      );
  }),

  create: protectedProcedure
    .input(createHomeopathicMedicineSchema)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(homeopathicMedicines)
        .values({
          providerId: ctx.session.userId,
          name: input.name.trim(),
          potency: input.potency.trim(),
          notes: input.notes?.trim() || null,
        })
        .returning();
      if (created) {
        logAudit(ctx, {
          action: "create",
          resource: "homeopathic_medicine",
          resourceId: created.id,
        });
      }
      return created;
    }),

  update: protectedProcedure
    .input(updateHomeopathicMedicineSchema)
    .mutation(async ({ ctx, input }) => {
      const patch: { name?: string; potency?: string; notes?: string | null } =
        {};
      if (input.name !== undefined) patch.name = input.name.trim();
      if (input.potency !== undefined) patch.potency = input.potency.trim();
      if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;

      const [updated] = await ctx.db
        .update(homeopathicMedicines)
        .set(patch)
        .where(
          and(
            eq(homeopathicMedicines.id, input.id),
            eq(homeopathicMedicines.providerId, ctx.session.userId),
          ),
        )
        .returning();
      if (updated) {
        logAudit(ctx, {
          action: "update",
          resource: "homeopathic_medicine",
          resourceId: updated.id,
        });
      }
      return updated ?? null;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(homeopathicMedicines)
        .where(
          and(
            eq(homeopathicMedicines.id, input.id),
            eq(homeopathicMedicines.providerId, ctx.session.userId),
          ),
        )
        .returning();
      if (deleted) {
        logAudit(ctx, {
          action: "delete",
          resource: "homeopathic_medicine",
          resourceId: deleted.id,
        });
      }
      return deleted ?? null;
    }),
});

import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import { homeopathicMedicines } from "@docnotes/db";
import {
  createHomeopathicMedicineSchema,
  updateHomeopathicMedicineSchema,
} from "@docnotes/shared";
import { protectedProcedure, router } from "../trpc.js";
import { logAudit } from "../lib/audit.js";

const DEFAULT_MEDICINES: ReadonlyArray<{ name: string; potency: string }> = [
  { name: "Arnica Montana", potency: "30C" },
  { name: "Arnica Montana", potency: "200C" },
  { name: "Arsenicum Album", potency: "30C" },
  { name: "Arsenicum Album", potency: "200C" },
  { name: "Belladonna", potency: "30C" },
  { name: "Nux Vomica", potency: "30C" },
  { name: "Pulsatilla Nigricans", potency: "30C" },
  { name: "Rhus Toxicodendron", potency: "30C" },
  { name: "Bryonia Alba", potency: "30C" },
  { name: "Chamomilla", potency: "30C" },
  { name: "Allium Cepa", potency: "30C" },
  { name: "Aconitum Napellus", potency: "30C" },
];

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

  seedDefaults: protectedProcedure.mutation(async ({ ctx }) => {
    // Insert only the defaults that aren't already present for this
    // provider (matched on name+potency, case-insensitive). The earlier
    // "skip if any row exists at all" check (Manoj msg 854 → b08e733)
    // wedged accounts that had added one stray medicine (msg 971: he
    // had Belladonna 30C and never got the other 11 defaults). This
    // version is idempotent — tapping the button on a populated list
    // tops up the missing defaults without duplicating anything.
    const existing = await ctx.db
      .select({
        name: homeopathicMedicines.name,
        potency: homeopathicMedicines.potency,
      })
      .from(homeopathicMedicines)
      .where(eq(homeopathicMedicines.providerId, ctx.session.userId));
    const existingKey = new Set(
      existing.map((r) => `${r.name.toLowerCase()}|${r.potency.toLowerCase()}`),
    );
    const toInsert = DEFAULT_MEDICINES.filter(
      (d) =>
        !existingKey.has(`${d.name.toLowerCase()}|${d.potency.toLowerCase()}`),
    );
    if (toInsert.length === 0) {
      return { inserted: 0 };
    }
    await ctx.db.insert(homeopathicMedicines).values(
      toInsert.map((d) => ({
        providerId: ctx.session.userId,
        name: d.name,
        potency: d.potency,
      })),
    );
    logAudit(ctx, {
      action: "seed_defaults",
      resource: "homeopathic_medicine",
    });
    return { inserted: toInsert.length };
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

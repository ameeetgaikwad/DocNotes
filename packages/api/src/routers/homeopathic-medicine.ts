import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import { auditLogs, homeopathicMedicines } from "@docnotes/db";
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
    // Refuse if any prior homeopathic-medicine activity exists for this
    // user (create / update / delete / seed_defaults all show up in
    // audit_logs). This means the seed only fires on a truly fresh
    // account — deleting everything intentionally won't make the
    // defaults pop back next time the page loads.
    const priorActivity = await ctx.db
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.userId, ctx.session.userId),
          eq(auditLogs.resource, "homeopathic_medicine"),
        ),
      )
      .limit(1);
    if (priorActivity.length > 0) {
      return { inserted: 0 };
    }
    // Belt-and-suspenders: also bail if there happen to be medicines
    // already but no audit log (would only happen for very old rows
    // pre-audit-logging).
    const existing = await ctx.db
      .select({ id: homeopathicMedicines.id })
      .from(homeopathicMedicines)
      .where(eq(homeopathicMedicines.providerId, ctx.session.userId))
      .limit(1);
    if (existing.length > 0) {
      return { inserted: 0 };
    }
    await ctx.db.insert(homeopathicMedicines).values(
      DEFAULT_MEDICINES.map((d) => ({
        providerId: ctx.session.userId,
        name: d.name,
        potency: d.potency,
      })),
    );
    logAudit(ctx, {
      action: "seed_defaults",
      resource: "homeopathic_medicine",
    });
    return { inserted: DEFAULT_MEDICINES.length };
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

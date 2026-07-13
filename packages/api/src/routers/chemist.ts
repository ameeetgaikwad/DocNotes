import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { chemists } from "@docnotes/db";
import { upsertChemistSchema } from "@docnotes/shared";
import { protectedProcedure, router } from "../trpc.js";
import { logAudit } from "../lib/audit.js";

// Chemists / pharmacy contacts (Manoj msg 2267). Follows the same
// upsert-and-list shape as medicine dealers, hard-delete on remove
// (Manoj msg 2300 — chemists are a contact list, not medical data).

// Detects the pg "relation does not exist" error (42P01). The chemists
// table lands via migration 0026_chemists.sql — if a deploy raced ahead
// of the migration (Manoj msg 2322), we return a clean setup-required
// message instead of leaking the raw Drizzle query dump.
function isMissingTableError(err: unknown): boolean {
  if (!err) return false;
  const asAny = err as { code?: string; cause?: { code?: string } };
  if (asAny.code === "42P01" || asAny.cause?.code === "42P01") return true;
  const stringified = err instanceof Error ? err.message : String(err);
  return (
    stringified.includes("42P01") ||
    stringified.includes('relation "chemists" does not exist')
  );
}

function friendlyDbError(err: unknown, verb: "save" | "delete"): never {
  if (isMissingTableError(err)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Chemists is being set up. Please try again in a few minutes — if the issue persists, tell the developer the database migration hasn't run.",
    });
  }
  // Any other DB error: clean generic message instead of the SQL dump.
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: `Could not ${verb} the chemist right now. Try again in a moment.`,
  });
}

export const chemistRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await ctx.db
        .select()
        .from(chemists)
        .where(eq(chemists.providerId, ctx.session.userId))
        .orderBy(asc(chemists.name));
    } catch (err) {
      // Empty-list is the safest degrade for the read path — the UI
      // shows "No chemists saved yet" instead of a red banner while the
      // migration lag resolves. The upsert catch will still block writes
      // with a clear message.
      if (isMissingTableError(err)) return [];
      throw err;
    }
  }),

  upsert: protectedProcedure
    .input(upsertChemistSchema)
    .mutation(async ({ ctx, input }) => {
      const values = {
        name: input.name.trim(),
        whatsappNumber: input.whatsappNumber.trim(),
        notes: input.notes?.trim() ? input.notes.trim() : null,
      };

      try {
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
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        return friendlyDbError(err, "save");
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
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
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        return friendlyDbError(err, "delete");
      }
    }),
});

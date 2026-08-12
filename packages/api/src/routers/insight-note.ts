import { z } from "zod";
import { eq, and, desc, isNull, or, ilike, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { insightNotes } from "@docnotes/db";
import { upsertInsightNoteSchema } from "@docnotes/shared";
import { protectedProcedure, router } from "../trpc.js";
import { logAudit } from "../lib/audit.js";

// Personal insight notes (Manoj msg 2595). CRUD + search over
// title + body. Soft delete per Manoj msg 2597 so a valuable
// observation isn't lost to an accidental tap. Same friendly-error
// shape as the chemists router — if a deploy outruns the migration,
// the UI gets a clean "being set up" message rather than a SQL dump.

function isMissingTableError(err: unknown): boolean {
  if (!err) return false;
  const asAny = err as { code?: string; cause?: { code?: string } };
  if (asAny.code === "42P01" || asAny.cause?.code === "42P01") return true;
  const stringified = err instanceof Error ? err.message : String(err);
  return (
    stringified.includes("42P01") ||
    stringified.includes('relation "insight_notes" does not exist')
  );
}

function friendlyDbError(err: unknown, verb: "save" | "delete"): never {
  if (isMissingTableError(err)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Insight Notes is being set up. Please try again in a few minutes — if the issue persists, tell the developer the database migration hasn't run.",
    });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: `Could not ${verb} the note right now. Try again in a moment.`,
  });
}

export const insightNoteRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          query: z.string().trim().max(200).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const q = input?.query?.trim();
      try {
        const baseConditions = [
          eq(insightNotes.providerId, ctx.session.userId),
          // Soft-delete filter: only surface live notes. Deleted
          // rows stay in the table for potential future recovery.
          isNull(insightNotes.deletedAt),
        ];
        if (q) {
          // Case-insensitive substring match on title OR body.
          // Escape LIKE metacharacters so a search containing % or _
          // doesn't return every note.
          const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
          baseConditions.push(
            or(
              ilike(insightNotes.title, pattern),
              ilike(insightNotes.body, pattern),
            )!,
          );
        }
        return await ctx.db
          .select()
          .from(insightNotes)
          .where(and(...baseConditions))
          .orderBy(desc(insightNotes.updatedAt));
      } catch (err) {
        if (isMissingTableError(err)) return [];
        throw err;
      }
    }),

  upsert: protectedProcedure
    .input(upsertInsightNoteSchema)
    .mutation(async ({ ctx, input }) => {
      const values = {
        title: input.title?.trim() ? input.title.trim() : null,
        body: input.body.trim(),
      };

      try {
        if (input.id) {
          const [updated] = await ctx.db
            .update(insightNotes)
            .set(values)
            .where(
              and(
                eq(insightNotes.id, input.id),
                eq(insightNotes.providerId, ctx.session.userId),
                // Don't accidentally revive a soft-deleted note on
                // update — an edit against a deleted id should no-op.
                isNull(insightNotes.deletedAt),
              ),
            )
            .returning();
          if (updated) {
            logAudit(ctx, {
              action: "update",
              resource: "insight_note",
              resourceId: updated.id,
            });
          }
          return updated ?? null;
        }

        const [created] = await ctx.db
          .insert(insightNotes)
          .values({ providerId: ctx.session.userId, ...values })
          .returning();
        if (created) {
          logAudit(ctx, {
            action: "create",
            resource: "insight_note",
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
        // Soft delete: stamp deletedAt so the list filter hides it.
        const [deleted] = await ctx.db
          .update(insightNotes)
          .set({ deletedAt: sql`now()` })
          .where(
            and(
              eq(insightNotes.id, input.id),
              eq(insightNotes.providerId, ctx.session.userId),
              isNull(insightNotes.deletedAt),
            ),
          )
          .returning();
        if (deleted) {
          logAudit(ctx, {
            action: "delete",
            resource: "insight_note",
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

import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { clinicHolidays } from "@docnotes/db";
import { upsertClinicHolidaySchema } from "@docnotes/shared";
import { protectedProcedure, router } from "../trpc.js";
import { logAudit } from "../lib/audit.js";

// Clinic holidays / closed dates (Manoj msg 2595). CRUD-only —
// no export, no cross-feature integration. Hard delete per
// Manoj msg 2597. Same friendly-error shape as the chemists router
// so a deploy that outruns the migration doesn't leak SQL to the UI.

function isMissingTableError(err: unknown): boolean {
  if (!err) return false;
  const asAny = err as { code?: string; cause?: { code?: string } };
  if (asAny.code === "42P01" || asAny.cause?.code === "42P01") return true;
  const stringified = err instanceof Error ? err.message : String(err);
  return (
    stringified.includes("42P01") ||
    stringified.includes('relation "clinic_holidays" does not exist')
  );
}

function friendlyDbError(err: unknown, verb: "save" | "delete"): never {
  if (isMissingTableError(err)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Clinic Holidays is being set up. Please try again in a few minutes — if the issue persists, tell the developer the database migration hasn't run.",
    });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: `Could not ${verb} the holiday right now. Try again in a moment.`,
  });
}

export const clinicHolidayRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Manoj: "newest first" — sort by holidayDate DESC so the most
      // recent closed date sits at the top of the list.
      return await ctx.db
        .select()
        .from(clinicHolidays)
        .where(eq(clinicHolidays.providerId, ctx.session.userId))
        .orderBy(
          desc(clinicHolidays.holidayDate),
          desc(clinicHolidays.createdAt),
        );
    } catch (err) {
      if (isMissingTableError(err)) return [];
      throw err;
    }
  }),

  upsert: protectedProcedure
    .input(upsertClinicHolidaySchema)
    .mutation(async ({ ctx, input }) => {
      const values = {
        holidayDate: input.holidayDate,
        reason: input.reason,
        note: input.note?.trim() ? input.note.trim() : null,
      };

      try {
        if (input.id) {
          const [updated] = await ctx.db
            .update(clinicHolidays)
            .set(values)
            .where(
              and(
                eq(clinicHolidays.id, input.id),
                eq(clinicHolidays.providerId, ctx.session.userId),
              ),
            )
            .returning();
          if (updated) {
            logAudit(ctx, {
              action: "update",
              resource: "clinic_holiday",
              resourceId: updated.id,
            });
          }
          return updated ?? null;
        }

        const [created] = await ctx.db
          .insert(clinicHolidays)
          .values({ providerId: ctx.session.userId, ...values })
          .returning();
        if (created) {
          logAudit(ctx, {
            action: "create",
            resource: "clinic_holiday",
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
          .delete(clinicHolidays)
          .where(
            and(
              eq(clinicHolidays.id, input.id),
              eq(clinicHolidays.providerId, ctx.session.userId),
            ),
          )
          .returning();
        if (deleted) {
          logAudit(ctx, {
            action: "delete",
            resource: "clinic_holiday",
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

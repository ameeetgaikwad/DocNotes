import { eq, and, desc, sql, isNull, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { Database } from "@docnotes/db";
import { patientVisits, patients } from "@docnotes/db";
import {
  patientVisitListSchema,
  updatePatientVisitSchema,
} from "@docnotes/shared";
import { protectedProcedure, router } from "../trpc.js";
import { logAudit } from "../lib/audit.js";

async function assertPatientOwned(
  db: Database,
  patientId: string,
  userId: string,
): Promise<void> {
  const owned = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.createdBy, userId)))
    .limit(1);
  if (owned.length === 0) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Patient not found" });
  }
}

export const patientVisitRouter = router({
  listByPatient: protectedProcedure
    .input(patientVisitListSchema)
    .query(async ({ ctx, input }) => {
      await assertPatientOwned(ctx.db, input.patientId, ctx.session.userId);
      const rows = await ctx.db
        .select()
        .from(patientVisits)
        .where(
          and(
            eq(patientVisits.patientId, input.patientId),
            eq(patientVisits.providerId, ctx.session.userId),
          ),
        )
        .orderBy(desc(patientVisits.visitDate));
      return rows;
    }),

  update: protectedProcedure
    .input(updatePatientVisitSchema)
    .mutation(async ({ ctx, input }) => {
      const patch: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input.data)) {
        if (value !== undefined) patch[key] = value;
      }
      if (Object.keys(patch).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No fields to update",
        });
      }
      const [visit] = await ctx.db
        .update(patientVisits)
        .set(patch)
        .where(
          and(
            eq(patientVisits.id, input.id),
            eq(patientVisits.providerId, ctx.session.userId),
          ),
        )
        .returning();
      if (!visit) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Visit not found" });
      }
      logAudit(ctx, {
        action: "update",
        resource: "patient_visit",
        resourceId: visit.id,
      });
      return visit;
    }),
});

// Helper used by daily-register.create — idempotent ensure-visit-for-date.
// Multiple register entries on the same day map to a single visit row.
export async function ensureVisitForDate(
  db: Database,
  providerId: string,
  patientId: string,
  visitDate: string,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO ${patientVisits} (provider_id, patient_id, visit_date)
    VALUES (${providerId}, ${patientId}::uuid, ${visitDate}::date)
    ON CONFLICT (patient_id, visit_date) DO NOTHING
  `);
}

/**
 * Copy a daily-register entry's notes into the matching same-date visit's
 * `clinicalNotes` field — but only when the visit's clinicalNotes is
 * currently empty. That way the doctor can still hand-edit the History
 * notes later without future register-entry edits clobbering them.
 *
 * No-op when entryNotes is null/blank.
 */
export async function syncEntryNotesToVisit(
  db: Database,
  providerId: string,
  patientId: string,
  visitDate: string,
  entryNotes: string | null | undefined,
): Promise<void> {
  const trimmed = entryNotes?.trim();
  if (!trimmed) return;
  await db
    .update(patientVisits)
    .set({ clinicalNotes: trimmed })
    .where(
      and(
        eq(patientVisits.providerId, providerId),
        eq(patientVisits.patientId, patientId),
        eq(patientVisits.visitDate, visitDate),
        or(
          isNull(patientVisits.clinicalNotes),
          eq(patientVisits.clinicalNotes, ""),
        ),
      ),
    );
}

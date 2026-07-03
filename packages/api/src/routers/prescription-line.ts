import { z } from "zod";
import { and, eq, sql, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  prescriptionLines,
  patientVisits,
  patients,
  dailyRegisterEntries,
} from "@docnotes/db";
import {
  upsertPrescriptionSchema,
  isNonTabletMedicine,
} from "@docnotes/shared";
import { protectedProcedure, router } from "../trpc.js";
import { logAudit } from "../lib/audit.js";
import { ensureVisitForDate } from "./patient-visit.js";

// Format a prescription line as the short "medicine name - N tabs" text
// that gets appended to the visit's clinical notes (Manoj msg 1947).
// Suppresses the "N tabs" suffix for suspensions, syrups, drops,
// injections, creams, etc. — those aren't measured in tablets (Manoj
// msg 2080). Falls back to just the medicine name when quantity is
// absent or the medicine isn't a tablet.
function shortLineForNotes(line: {
  medicineName: string;
  quantity: number | null;
}): string {
  if (
    line.quantity &&
    line.quantity > 0 &&
    !isNonTabletMedicine(line.medicineName)
  ) {
    return `${line.medicineName} - ${line.quantity} tab${line.quantity === 1 ? "" : "s"}`;
  }
  return line.medicineName;
}

function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const prescriptionLineRouter = router({
  // Load the Rx for a given visit — used by the /prescribe page when
  // the doctor re-opens an existing visit to iterate on the prescription.
  listByVisit: protectedProcedure
    .input(z.object({ visitId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(prescriptionLines)
        .where(
          and(
            eq(prescriptionLines.visitId, input.visitId),
            eq(prescriptionLines.providerId, ctx.session.userId),
          ),
        )
        .orderBy(prescriptionLines.position);
    }),

  // Frequently-used medicines for this doctor — top 8 by count in the
  // last 90 days. Powers the chip strip above the medicine repeater
  // (Manoj msg 1947 C3).
  frequentlyUsed: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        medicineName: prescriptionLines.medicineName,
        count: sql<number>`count(*)`,
      })
      .from(prescriptionLines)
      .where(
        and(
          eq(prescriptionLines.providerId, ctx.session.userId),
          sql`${prescriptionLines.createdAt} >= now() - interval '90 days'`,
        ),
      )
      .groupBy(prescriptionLines.medicineName)
      .orderBy(desc(sql`count(*)`))
      .limit(8);
    return rows.map((r) => ({
      medicineName: r.medicineName,
      count: Number(r.count),
    }));
  }),

  // Upsert: replace the visit's prescription with the incoming lines,
  // create the visit row if it doesn't exist, and append short medicine
  // lines to the visit's clinical_notes (Manoj msg 1947: one-way flow
  // Prescription → Clinical Notes).
  upsert: protectedProcedure
    .input(upsertPrescriptionSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify patient ownership before touching anything.
      const owned = await ctx.db
        .select({ id: patients.id })
        .from(patients)
        .where(
          and(
            eq(patients.id, input.patientId),
            eq(patients.createdBy, ctx.session.userId),
          ),
        )
        .limit(1);
      if (owned.length === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Patient not found",
        });
      }

      const visitDate = input.visitDate ?? today();
      await ensureVisitForDate(
        ctx.db,
        ctx.session.userId,
        input.patientId,
        visitDate,
      );
      const [visit] = await ctx.db
        .select({
          id: patientVisits.id,
          clinicalNotes: patientVisits.clinicalNotes,
        })
        .from(patientVisits)
        .where(
          and(
            eq(patientVisits.providerId, ctx.session.userId),
            eq(patientVisits.patientId, input.patientId),
            eq(patientVisits.visitDate, visitDate),
          ),
        )
        .limit(1);
      if (!visit) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Visit row could not be found or created",
        });
      }

      // Replace the visit's Rx wholesale — simpler than diffing each
      // line, and preserves position ordering trivially.
      await ctx.db
        .delete(prescriptionLines)
        .where(eq(prescriptionLines.visitId, visit.id));

      if (input.lines.length > 0) {
        await ctx.db.insert(prescriptionLines).values(
          input.lines.map((l, i) => ({
            visitId: visit.id,
            providerId: ctx.session.userId,
            position: i,
            medicineName: l.medicineName,
            dosage: l.dosage ?? null,
            frequency: l.frequency ?? null,
            duration: l.duration ?? null,
            quantity: l.quantity ?? null,
            instructions: l.instructions ?? null,
          })),
        );
      }

      // Append short "medicine - N tabs" lines to clinical_notes. This
      // is one-way per Manoj msg 1947 — the doctor editing Clinical
      // Notes later doesn't reflect back into the Rx, but a subsequent
      // Rx save will re-append (idempotent within a single Save cycle
      // via the clean-slate delete above and the append below).
      const shortText = input.lines
        .map((l) =>
          shortLineForNotes({
            medicineName: l.medicineName,
            quantity: l.quantity ?? null,
          }),
        )
        .join("\n");
      if (shortText) {
        const previousNotes = visit.clinicalNotes?.trim() ?? "";
        // Strip any prior auto-appended Rx block so re-saving doesn't
        // accumulate duplicates. The block is always appended at the
        // END of notes with a leading "Rx" header (Manoj msg 2078 —
        // drop the {rx: begin}/{rx: end} scaffolding, keep a clean
        // "Rx" heading), so re-save reliably finds and removes it by
        // truncating from the last standalone "Rx" line to end-of-text.
        // Also strips the legacy {rx: begin}/{rx: end} format for old
        // entries created before this change.
        let cleaned = previousNotes;
        const LEGACY_START = "{rx: begin}";
        const LEGACY_END = "{rx: end}";
        const legacyStartIdx = cleaned.indexOf(LEGACY_START);
        const legacyEndIdx = cleaned.indexOf(LEGACY_END);
        if (
          legacyStartIdx !== -1 &&
          legacyEndIdx !== -1 &&
          legacyEndIdx > legacyStartIdx
        ) {
          cleaned = (
            cleaned.slice(0, legacyStartIdx).trimEnd() +
            "\n" +
            cleaned.slice(legacyEndIdx + LEGACY_END.length).trimStart()
          ).trim();
        }
        // Find the last standalone "Rx" line (case-sensitive, exact,
        // to reduce false positives against doctor-typed "Rx:" notes).
        const rxHeaderMatch = /(^|\n)Rx\n/.exec(cleaned);
        if (rxHeaderMatch) {
          // Prefer the LAST occurrence in case the doctor also typed
          // "Rx" elsewhere; scan backwards.
          const lastIdx = cleaned.lastIndexOf("\nRx\n");
          const cutIdx = lastIdx === -1 ? 0 : lastIdx;
          cleaned = cleaned.slice(0, cutIdx).trimEnd();
        }
        const rxBlock = `Rx\n${shortText}`;
        const nextNotes = cleaned ? `${cleaned}\n\n${rxBlock}` : rxBlock;
        await ctx.db
          .update(patientVisits)
          .set({ clinicalNotes: nextNotes })
          .where(eq(patientVisits.id, visit.id));
      }

      // Manoj msg 2062 option (iii): if there's no Register entry for
      // this patient+date yet and we're saving a real Rx (>=1 medicine),
      // auto-create one with fee blank so it shows on Today's Register
      // and picks up the "Fees not recorded" flag. Skips silently when
      // an entry already exists (msg 2062 follow-up: don't clobber or
      // duplicate an existing entry).
      if (input.lines.length > 0) {
        const existing = await ctx.db
          .select({ id: dailyRegisterEntries.id })
          .from(dailyRegisterEntries)
          .where(
            and(
              eq(dailyRegisterEntries.providerId, ctx.session.userId),
              eq(dailyRegisterEntries.patientId, input.patientId),
              eq(dailyRegisterEntries.visitDate, visitDate),
            ),
          )
          .limit(1);
        if (existing.length === 0) {
          await ctx.db.insert(dailyRegisterEntries).values({
            providerId: ctx.session.userId,
            visitDate,
            patientId: input.patientId,
            serviceType: "Consultation",
            feeAmount: "0",
            paidAmount: "0",
            paymentMode: "cash",
            // Paid + fee 0 = "Fees not recorded yet" (Manoj msg 2001).
            paymentStatus: "paid",
          });
        }
      }

      // Cleanup (Manoj msg 2062): if the save yielded no Rx lines AND
      // the visit has no clinical notes / vitals / co-existing Register
      // entry, delete the auto-created visit row so it doesn't clutter
      // History. Same pattern as the daily-register.delete cleanup.
      if (input.lines.length === 0) {
        const [full] = await ctx.db
          .select()
          .from(patientVisits)
          .where(eq(patientVisits.id, visit.id))
          .limit(1);
        const noVitals =
          full &&
          full.bpSystolic === null &&
          full.bpDiastolic === null &&
          full.heartRate === null &&
          full.spO2Percent === null &&
          !full.bslFasting &&
          !full.bslPostprandial &&
          !full.bslRandom &&
          !full.temperatureCelsius &&
          !full.weightKg &&
          !full.heightCm;
        const noNotes = !full?.clinicalNotes?.trim();
        if (noVitals && noNotes) {
          const [entryPresent] = await ctx.db
            .select({ id: dailyRegisterEntries.id })
            .from(dailyRegisterEntries)
            .where(
              and(
                eq(dailyRegisterEntries.providerId, ctx.session.userId),
                eq(dailyRegisterEntries.patientId, input.patientId),
                eq(dailyRegisterEntries.visitDate, visitDate),
              ),
            )
            .limit(1);
          if (!entryPresent) {
            await ctx.db
              .delete(patientVisits)
              .where(eq(patientVisits.id, visit.id));
            return { visitId: null, lineCount: 0 };
          }
        }
      }

      logAudit(ctx, {
        action: "upsert",
        resource: "prescription_lines",
        resourceId: visit.id,
      });

      return { visitId: visit.id, lineCount: input.lines.length };
    }),
});

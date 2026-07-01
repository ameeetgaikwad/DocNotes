import { z } from "zod";
import { and, eq, sql, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { prescriptionLines, patientVisits, patients } from "@docnotes/db";
import { upsertPrescriptionSchema } from "@docnotes/shared";
import { protectedProcedure, router } from "../trpc.js";
import { logAudit } from "../lib/audit.js";
import { ensureVisitForDate } from "./patient-visit.js";

// Format a prescription line as the short "medicine name - N tabs" text
// that gets appended to the visit's clinical notes (Manoj msg 1947).
// Falls back to just the medicine name when we don't have a total count.
function shortLineForNotes(line: {
  medicineName: string;
  quantity: number | null;
}): string {
  if (line.quantity && line.quantity > 0) {
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
        // Strip any lines that came from a PRIOR Rx save on this visit
        // so re-saving doesn't accumulate duplicates. Marker: {rx: N} lines
        // block delimited on both ends.
        const RX_MARKER_START = "{rx: begin}";
        const RX_MARKER_END = "{rx: end}";
        const startIdx = previousNotes.indexOf(RX_MARKER_START);
        const endIdx = previousNotes.indexOf(RX_MARKER_END);
        let cleaned = previousNotes;
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          cleaned = (
            previousNotes.slice(0, startIdx).trimEnd() +
            "\n" +
            previousNotes.slice(endIdx + RX_MARKER_END.length).trimStart()
          ).trim();
        }
        const rxBlock = [RX_MARKER_START, shortText, RX_MARKER_END].join("\n");
        const nextNotes = cleaned ? `${cleaned}\n${rxBlock}` : rxBlock;
        await ctx.db
          .update(patientVisits)
          .set({ clinicalNotes: nextNotes })
          .where(eq(patientVisits.id, visit.id));
      }

      logAudit(ctx, {
        action: "upsert",
        resource: "prescription_lines",
        resourceId: visit.id,
      });

      return { visitId: visit.id, lineCount: input.lines.length };
    }),
});

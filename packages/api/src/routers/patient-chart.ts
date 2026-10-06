import { z } from "zod";
import { eq, and, asc, isNull, isNotNull, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { chartDefinitions, chartReadings, patientVisits } from "@docnotes/db";
import {
  addChartReadingSchema,
  upsertChartDefinitionSchema,
} from "@docnotes/shared";
import { protectedProcedure, router } from "../trpc.js";
import { logAudit } from "../lib/audit.js";
import { assertPatientOwned } from "./patient-visit.js";

// Patient Charts (Amit msg 3051, spec Manoj msg 3054).
// - BP / Sugar / Weight read straight from patient_visits (read-only
//   here; the doctor edits those in Clinical History).
// - Extra readings + doctor-wide custom charts live in chart_* tables.
// - One-way sync: nothing in this router writes to patient_visits.
// - Soft delete via deletedAt.

function isMissingTableError(err: unknown): boolean {
  if (!err) return false;
  const asAny = err as { code?: string; cause?: { code?: string } };
  if (asAny.code === "42P01" || asAny.cause?.code === "42P01") return true;
  const stringified = err instanceof Error ? err.message : String(err);
  return (
    stringified.includes("42P01") ||
    stringified.includes('relation "chart_definitions" does not exist') ||
    stringified.includes('relation "chart_readings" does not exist')
  );
}

function friendlyDbError(err: unknown, verb: "save" | "delete"): never {
  if (err instanceof TRPCError) throw err;
  if (isMissingTableError(err)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Charts is being set up. Please try again in a few minutes — if the issue persists, tell the developer the database migration hasn't run.",
    });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: `Could not ${verb} right now. Try again in a moment.`,
  });
}

function toNum(v: string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export const patientChartRouter = router({
  // Everything the Charts screen needs for one patient in one call.
  forPatient: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.userId;
      await assertPatientOwned(ctx.db, input.patientId, userId);

      const visitRows = await ctx.db
        .select({
          id: patientVisits.id,
          visitDate: patientVisits.visitDate,
          bpSystolic: patientVisits.bpSystolic,
          bpDiastolic: patientVisits.bpDiastolic,
          bslFasting: patientVisits.bslFasting,
          bslPostprandial: patientVisits.bslPostprandial,
          bslRandom: patientVisits.bslRandom,
          weightKg: patientVisits.weightKg,
        })
        .from(patientVisits)
        .where(
          and(
            eq(patientVisits.patientId, input.patientId),
            eq(patientVisits.providerId, userId),
            or(
              isNotNull(patientVisits.bpSystolic),
              isNotNull(patientVisits.bslFasting),
              isNotNull(patientVisits.bslPostprandial),
              isNotNull(patientVisits.bslRandom),
              isNotNull(patientVisits.weightKg),
            ),
          ),
        )
        .orderBy(asc(patientVisits.visitDate));

      const visits = visitRows.map((v) => ({
        id: v.id,
        date: v.visitDate,
        bpSystolic: v.bpSystolic,
        bpDiastolic: v.bpDiastolic,
        bslFasting: toNum(v.bslFasting),
        bslPostprandial: toNum(v.bslPostprandial),
        bslRandom: toNum(v.bslRandom),
        weightKg: toNum(v.weightKg),
      }));

      // Before the migration lands, still show visit-sourced charts.
      try {
        const definitions = await ctx.db
          .select()
          .from(chartDefinitions)
          .where(
            and(
              eq(chartDefinitions.providerId, userId),
              isNull(chartDefinitions.deletedAt),
            ),
          )
          .orderBy(asc(chartDefinitions.createdAt));

        const readingRows = await ctx.db
          .select()
          .from(chartReadings)
          .where(
            and(
              eq(chartReadings.patientId, input.patientId),
              eq(chartReadings.providerId, userId),
              isNull(chartReadings.deletedAt),
            ),
          )
          .orderBy(
            asc(chartReadings.readingDate),
            asc(chartReadings.createdAt),
          );

        const liveDefIds = new Set(definitions.map((d) => d.id));
        const readings = readingRows
          .filter(
            (r) =>
              r.metric !== "custom" ||
              (r.definitionId && liveDefIds.has(r.definitionId)),
          )
          .map((r) => ({
            id: r.id,
            metric: r.metric,
            definitionId: r.definitionId,
            date: r.readingDate,
            value: toNum(r.value) ?? 0,
            value2: toNum(r.value2),
            sugarType: r.sugarType,
          }));

        return {
          visits,
          readings,
          definitions: definitions.map((d) => ({
            id: d.id,
            name: d.name,
            unit: d.unit,
            normalMin: toNum(d.normalMin),
            normalMax: toNum(d.normalMax),
          })),
          ready: true,
        };
      } catch (err) {
        if (!isMissingTableError(err)) throw err;
        return { visits, readings: [], definitions: [], ready: false };
      }
    }),

  addReading: protectedProcedure
    .input(addChartReadingSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.userId;
      await assertPatientOwned(ctx.db, input.patientId, userId);
      try {
        if (input.metric === "custom") {
          const [def] = await ctx.db
            .select({ id: chartDefinitions.id })
            .from(chartDefinitions)
            .where(
              and(
                eq(chartDefinitions.id, input.definitionId!),
                eq(chartDefinitions.providerId, userId),
                isNull(chartDefinitions.deletedAt),
              ),
            )
            .limit(1);
          if (!def) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Chart not found",
            });
          }
        }
        const [created] = await ctx.db
          .insert(chartReadings)
          .values({
            providerId: userId,
            patientId: input.patientId,
            metric: input.metric,
            definitionId:
              input.metric === "custom" ? input.definitionId! : null,
            readingDate: input.readingDate,
            value: String(input.value),
            value2:
              input.metric === "bp" && input.value2 != null
                ? String(input.value2)
                : null,
            sugarType: input.metric === "sugar" ? input.sugarType! : null,
          })
          .returning();
        if (created) {
          logAudit(ctx, {
            action: "create",
            resource: "chart_reading",
            resourceId: created.id,
          });
        }
        return created ?? null;
      } catch (err) {
        return friendlyDbError(err, "save");
      }
    }),

  deleteReading: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const [deleted] = await ctx.db
          .update(chartReadings)
          .set({ deletedAt: sql`now()` })
          .where(
            and(
              eq(chartReadings.id, input.id),
              eq(chartReadings.providerId, ctx.session.userId),
              isNull(chartReadings.deletedAt),
            ),
          )
          .returning({ id: chartReadings.id });
        if (deleted) {
          logAudit(ctx, {
            action: "delete",
            resource: "chart_reading",
            resourceId: deleted.id,
          });
        }
        return deleted ?? null;
      } catch (err) {
        return friendlyDbError(err, "delete");
      }
    }),

  upsertDefinition: protectedProcedure
    .input(upsertChartDefinitionSchema)
    .mutation(async ({ ctx, input }) => {
      const values = {
        name: input.name.trim(),
        unit: input.unit?.trim() ? input.unit.trim() : null,
        normalMin: input.normalMin != null ? String(input.normalMin) : null,
        normalMax: input.normalMax != null ? String(input.normalMax) : null,
      };
      try {
        if (input.id) {
          const [updated] = await ctx.db
            .update(chartDefinitions)
            .set(values)
            .where(
              and(
                eq(chartDefinitions.id, input.id),
                eq(chartDefinitions.providerId, ctx.session.userId),
                isNull(chartDefinitions.deletedAt),
              ),
            )
            .returning();
          if (updated) {
            logAudit(ctx, {
              action: "update",
              resource: "chart_definition",
              resourceId: updated.id,
            });
          }
          return updated ?? null;
        }
        const [created] = await ctx.db
          .insert(chartDefinitions)
          .values({ providerId: ctx.session.userId, ...values })
          .returning();
        if (created) {
          logAudit(ctx, {
            action: "create",
            resource: "chart_definition",
            resourceId: created.id,
          });
        }
        return created ?? null;
      } catch (err) {
        return friendlyDbError(err, "save");
      }
    }),

  // Soft-deletes the chart for every patient. Its readings stay in the
  // table untouched, so restoring the definition brings them back.
  deleteDefinition: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const [deleted] = await ctx.db
          .update(chartDefinitions)
          .set({ deletedAt: sql`now()` })
          .where(
            and(
              eq(chartDefinitions.id, input.id),
              eq(chartDefinitions.providerId, ctx.session.userId),
              isNull(chartDefinitions.deletedAt),
            ),
          )
          .returning({ id: chartDefinitions.id });
        if (deleted) {
          logAudit(ctx, {
            action: "delete",
            resource: "chart_definition",
            resourceId: deleted.id,
          });
        }
        return deleted ?? null;
      } catch (err) {
        return friendlyDbError(err, "delete");
      }
    }),
});

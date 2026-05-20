import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  and,
  eq,
  ilike,
  or,
  desc,
  sql,
  exists,
  isNotNull,
  ne,
  getTableColumns,
} from "drizzle-orm";
import { patients, dailyRegisterEntries, patientVisits } from "@docnotes/db";
import {
  createPatientSchema,
  updatePatientSchema,
  patientSearchSchema,
  quickCreatePatientSchema,
  updatePatientDobSchema,
} from "@docnotes/shared";
import { protectedProcedure, router } from "../trpc.js";
import { logAudit } from "../lib/audit.js";
import { ensureVisitForDate } from "./patient-visit.js";

function todayIsoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const patientRouter = router({
  list: protectedProcedure
    .input(patientSearchSchema)
    .query(async ({ ctx, input }) => {
      const { query, page, limit } = input;
      const offset = (page - 1) * limit;

      const ownership = and(
        eq(patients.isActive, true),
        eq(patients.createdBy, ctx.session.userId),
      );

      const tokens = query ? query.trim().split(/\s+/).filter(Boolean) : [];
      const where =
        tokens.length > 0
          ? and(
              ownership,
              ...tokens.map((token) => {
                const like = `%${token}%`;
                return or(
                  ilike(patients.firstName, like),
                  ilike(patients.middleName, like),
                  ilike(patients.lastName, like),
                  ilike(patients.phone, like),
                  sql`${patients.activeConditions}::text ILIKE ${like}`,
                  exists(
                    ctx.db
                      .select({ one: sql`1` })
                      .from(dailyRegisterEntries)
                      .where(
                        and(
                          eq(dailyRegisterEntries.patientId, patients.id),
                          ilike(dailyRegisterEntries.diagnosis, like),
                        ),
                      ),
                  ),
                );
              }),
            )
          : ownership;

      const [items, countResult] = await Promise.all([
        ctx.db
          .select({
            ...getTableColumns(patients),
            // Most-recent non-empty diagnosis from this patient's daily
            // register entries — surfaced on the mobile list row per
            // Manoj msg 981. Manoj msg 1085 caught that it was rendering
            // blank: a previous version interpolated ${patients.id} into
            // the sql template, which drizzle rendered as a bare "id" and
            // PostgreSQL resolved against daily_register_entries.id (the
            // subquery's own column), so the WHERE never matched. Hand-
            // qualify with table names so the correlated subquery binds
            // to the outer "patients.id" instead.
            latestDiagnosis: sql<
              string | null
            >`(SELECT dr.diagnosis FROM daily_register_entries dr
                WHERE dr.patient_id = patients.id
                  AND dr.diagnosis IS NOT NULL
                  AND dr.diagnosis <> ''
                ORDER BY dr.visit_date DESC, dr.created_at DESC
                LIMIT 1)`,
          })
          .from(patients)
          .where(where)
          .orderBy(desc(patients.updatedAt))
          .limit(limit)
          .offset(offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(patients)
          .where(where),
      ]);

      return {
        items,
        total: Number(countResult[0]?.count ?? 0),
        page,
        limit,
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select()
        .from(patients)
        .where(
          and(
            eq(patients.id, input.id),
            eq(patients.createdBy, ctx.session.userId),
          ),
        )
        .limit(1);

      if (!result[0]) {
        return null;
      }
      return result[0];
    }),

  create: protectedProcedure
    .input(createPatientSchema)
    .mutation(async ({ ctx, input }) => {
      const { duplicateOverride, dateOfBirth, initialVitals, ...patientInput } =
        input;
      const [patient] = await ctx.db
        .insert(patients)
        .values({
          ...patientInput,
          lastName: patientInput.lastName ?? "",
          dateOfBirth: dateOfBirth
            ? dateOfBirth.toISOString().split("T")[0]!
            : null,
          gender: patientInput.gender ?? null,
          allergies: patientInput.allergies ?? [],
          activeConditions: patientInput.activeConditions ?? [],
          createdBy: ctx.session.userId,
        })
        .returning();

      logAudit(ctx, {
        action: duplicateOverride ? "create_dup_override" : "create",
        resource: "patient",
        resourceId: patient!.id,
        metadata: duplicateOverride
          ? {
              reason: duplicateOverride.reason,
              candidateIds: duplicateOverride.candidateIds,
            }
          : null,
      });

      // Receptionist-captured baseline vitals: spawn today's visit row
      // and seed it. The same row is reused later when the doctor adds
      // a Daily Register entry for this patient on the same date
      // (ensureVisitForDate is idempotent via the patient_id + visit_date
      // unique index), so the values flow naturally into History.
      const hasVitals =
        initialVitals &&
        (initialVitals.weightKg != null ||
          initialVitals.bpSystolic != null ||
          initialVitals.bpDiastolic != null ||
          initialVitals.spO2Percent != null ||
          initialVitals.temperatureCelsius != null);
      if (patient && hasVitals) {
        const visitDate = todayIsoDate();
        await ensureVisitForDate(
          ctx.db,
          ctx.session.userId,
          patient.id,
          visitDate,
        );
        await ctx.db
          .update(patientVisits)
          .set({
            weightKg: initialVitals.weightKg ?? null,
            bpSystolic: initialVitals.bpSystolic ?? null,
            bpDiastolic: initialVitals.bpDiastolic ?? null,
            spO2Percent: initialVitals.spO2Percent ?? null,
            temperatureCelsius: initialVitals.temperatureCelsius ?? null,
          })
          .where(
            and(
              eq(patientVisits.patientId, patient.id),
              eq(patientVisits.visitDate, visitDate),
              eq(patientVisits.providerId, ctx.session.userId),
            ),
          );
      }

      return patient;
    }),

  findByExactName: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(255) }))
    .query(async ({ ctx, input }) => {
      const target = input.name.trim().toLowerCase();
      if (!target) return null;
      const rows = await ctx.db
        .select({
          id: patients.id,
          firstName: patients.firstName,
          middleName: patients.middleName,
          lastName: patients.lastName,
        })
        .from(patients)
        .where(
          and(
            eq(patients.createdBy, ctx.session.userId),
            // Archived (soft-deleted) patients should not block name
            // reuse — otherwise the only way to add a new patient with
            // the same name is to hard-delete the archived record.
            eq(patients.isActive, true),
            sql`lower(regexp_replace(trim(${patients.firstName} || ' ' || coalesce(${patients.middleName}, '') || ' ' || ${patients.lastName}), '\\s+', ' ', 'g')) = ${target}`,
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    }),

  findByPhone: protectedProcedure
    .input(z.object({ phone: z.string().min(1).max(40) }))
    .query(async ({ ctx, input }) => {
      const digits = input.phone.replace(/\D/g, "");
      if (digits.length < 6) return [];
      const rows = await ctx.db
        .select()
        .from(patients)
        .where(
          and(
            eq(patients.isActive, true),
            eq(patients.createdBy, ctx.session.userId),
            sql`regexp_replace(coalesce(${patients.phone}, ''), '[^0-9]', '', 'g') LIKE ${`%${digits}%`}`,
          ),
        )
        .orderBy(desc(patients.updatedAt))
        .limit(5);
      return rows;
    }),

  quickCreate: protectedProcedure
    .input(quickCreatePatientSchema)
    .mutation(async ({ ctx, input }) => {
      const middleName = input.middleName?.trim()
        ? input.middleName.trim()
        : null;
      const [patient] = await ctx.db
        .insert(patients)
        .values({
          firstName: input.firstName,
          middleName,
          lastName: input.lastName ?? "",
          dobDay: input.dobDay ?? null,
          dobMonth: input.dobMonth ?? null,
          dobYear: input.dobYear ?? null,
          createdBy: ctx.session.userId,
        })
        .returning();

      if (patient) {
        logAudit(ctx, {
          action: "create",
          resource: "patient",
          resourceId: patient.id,
        });
      }

      return patient;
    }),

  updateDob: protectedProcedure
    .input(updatePatientDobSchema)
    .mutation(async ({ ctx, input }) => {
      const d = input.dobDay ?? null;
      const m = input.dobMonth ?? null;
      const y = input.dobYear ?? null;
      const fullDate =
        d !== null && m !== null && y !== null
          ? `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
          : null;
      const [patient] = await ctx.db
        .update(patients)
        .set({
          dobDay: d,
          dobMonth: m,
          dobYear: y,
          dateOfBirth: fullDate,
        })
        .where(
          and(
            eq(patients.id, input.id),
            eq(patients.createdBy, ctx.session.userId),
          ),
        )
        .returning();

      if (patient) {
        logAudit(ctx, {
          action: "update",
          resource: "patient",
          resourceId: patient.id,
        });
      }

      return patient ?? null;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), data: updatePatientSchema }))
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, unknown> = { ...input.data };
      if (input.data.dateOfBirth) {
        updateData.dateOfBirth = input.data.dateOfBirth
          .toISOString()
          .split("T")[0];
      }

      const [patient] = await ctx.db
        .update(patients)
        .set(updateData)
        .where(
          and(
            eq(patients.id, input.id),
            eq(patients.createdBy, ctx.session.userId),
          ),
        )
        .returning();

      logAudit(ctx, {
        action: "update",
        resource: "patient",
        resourceId: input.id,
      });

      return patient;
    }),

  responsiblePartyNames: protectedProcedure.query(async ({ ctx }) => {
    // Distinct list of Responsible Party labels this provider has used
    // before — powers the Summary card autocomplete (Manoj msg 1095 #4).
    // Sorted alphabetically; case preserved from the first occurrence.
    const rows = await ctx.db
      .selectDistinct({ name: patients.responsiblePartyName })
      .from(patients)
      .where(
        and(
          eq(patients.createdBy, ctx.session.userId),
          isNotNull(patients.responsiblePartyName),
          ne(patients.responsiblePartyName, ""),
        ),
      );
    return rows
      .map((r) => r.name)
      .filter((n): n is string => Boolean(n))
      .sort((a, b) => a.localeCompare(b));
  }),

  toggleMarked: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Persistent + clinic-wide red-name flag (Manoj msg 986, option a).
      // Anyone in the clinic can mark or unmark — the doctor still owns
      // the row via createdBy, so we scope to that.
      const [current] = await ctx.db
        .select({
          marked: patients.marked,
          updatedAt: patients.updatedAt,
        })
        .from(patients)
        .where(
          and(
            eq(patients.id, input.id),
            eq(patients.createdBy, ctx.session.userId),
          ),
        )
        .limit(1);
      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Patient not found",
        });
      }
      const next = !current.marked;
      // Explicitly carry the existing updatedAt forward — the schema's
      // $onUpdate bumps it on every update otherwise, and Manoj msg 1071
      // flagged that marking a patient was jumping their row to the top
      // of the desc-sorted list. Mark is a bookmark-like flag, not a
      // material edit, so the row's "last touched" time shouldn't move.
      const [updated] = await ctx.db
        .update(patients)
        .set({ marked: next, updatedAt: current.updatedAt })
        .where(
          and(
            eq(patients.id, input.id),
            eq(patients.createdBy, ctx.session.userId),
          ),
        )
        .returning();
      logAudit(ctx, {
        action: next ? "mark" : "unmark",
        resource: "patient",
        resourceId: input.id,
      });
      return updated ?? null;
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [patient] = await ctx.db
        .update(patients)
        .set({ isActive: false })
        .where(
          and(
            eq(patients.id, input.id),
            eq(patients.createdBy, ctx.session.userId),
          ),
        )
        .returning();

      logAudit(ctx, {
        action: "delete",
        resource: "patient",
        resourceId: input.id,
      });

      return patient;
    }),
});

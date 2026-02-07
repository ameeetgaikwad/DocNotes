import { eq, desc } from "drizzle-orm";
import { patients, medicalRecords } from "@docnotes/db";
import {
  exportPatientSummarySchema,
  exportMedicalRecordSchema,
} from "@docnotes/shared";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc.js";
import { logAudit } from "../lib/audit.js";
import { renderPatientSummaryPdf, renderMedicalRecordPdf } from "../lib/pdf.js";

export const exportRouter = router({
  patientSummary: protectedProcedure
    .input(exportPatientSummarySchema)
    .mutation(async ({ ctx, input }) => {
      const patientResult = await ctx.db
        .select()
        .from(patients)
        .where(eq(patients.id, input.patientId))
        .limit(1);

      const patient = patientResult[0];
      if (!patient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Patient not found",
        });
      }

      const records = await ctx.db
        .select()
        .from(medicalRecords)
        .where(eq(medicalRecords.patientId, input.patientId))
        .orderBy(desc(medicalRecords.createdAt))
        .limit(50);

      const pdfBuffer = await renderPatientSummaryPdf(
        {
          ...patient,
          allergies: (patient.allergies ?? []) as Array<{
            name: string;
            severity: string;
            reaction?: string;
          }>,
          activeConditions: (patient.activeConditions ?? []) as string[],
        },
        records.map((r) => ({
          title: r.title,
          type: r.type,
          createdAt: r.createdAt,
          content: r.content as {
            subjective?: string;
            objective?: string;
            assessment?: string;
            plan?: string;
          } | null,
          vitals: r.vitals as Record<string, number> | null,
          diagnoses: (r.diagnoses ?? []) as string[],
        })),
      );

      logAudit(ctx, {
        action: "export",
        resource: "patient",
        resourceId: input.patientId,
      });

      return {
        base64: pdfBuffer.toString("base64"),
        filename: `${patient.firstName}_${patient.lastName}_Summary.pdf`,
      };
    }),

  medicalRecord: protectedProcedure
    .input(exportMedicalRecordSchema)
    .mutation(async ({ ctx, input }) => {
      const recordResult = await ctx.db
        .select()
        .from(medicalRecords)
        .where(eq(medicalRecords.id, input.recordId))
        .limit(1);

      const record = recordResult[0];
      if (!record) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Medical record not found",
        });
      }

      const patientResult = await ctx.db
        .select()
        .from(patients)
        .where(eq(patients.id, record.patientId))
        .limit(1);

      const patient = patientResult[0];
      if (!patient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Patient not found",
        });
      }

      const pdfBuffer = await renderMedicalRecordPdf(
        {
          ...patient,
          allergies: (patient.allergies ?? []) as Array<{
            name: string;
            severity: string;
            reaction?: string;
          }>,
          activeConditions: (patient.activeConditions ?? []) as string[],
        },
        {
          title: record.title,
          type: record.type,
          createdAt: record.createdAt,
          content: record.content as {
            subjective?: string;
            objective?: string;
            assessment?: string;
            plan?: string;
          } | null,
          vitals: record.vitals as Record<string, number> | null,
          diagnoses: (record.diagnoses ?? []) as string[],
        },
      );

      logAudit(ctx, {
        action: "export",
        resource: "medical_record",
        resourceId: input.recordId,
      });

      return {
        base64: pdfBuffer.toString("base64"),
        filename: `${patient.firstName}_${patient.lastName}_${record.title.replace(/\s+/g, "_")}.pdf`,
      };
    }),
});

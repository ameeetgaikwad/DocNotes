import { eq, and, desc } from "drizzle-orm";
import {
  patients,
  medicalRecords,
  patientVisits,
  doctorProfiles,
} from "@docnotes/db";
import {
  exportPatientSummarySchema,
  exportMedicalRecordSchema,
  exportPrescriptionSchema,
} from "@docnotes/shared";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc.js";
import { logAudit } from "../lib/audit.js";
import {
  renderPatientSummaryPdf,
  renderMedicalRecordPdf,
  renderPrescriptionPdf,
} from "../lib/pdf.js";

export const exportRouter = router({
  patientSummary: protectedProcedure
    .input(exportPatientSummarySchema)
    .mutation(async ({ ctx, input }) => {
      const patientResult = await ctx.db
        .select()
        .from(patients)
        .where(
          and(
            eq(patients.id, input.patientId),
            eq(patients.createdBy, ctx.session.userId),
          ),
        )
        .limit(1);

      const patient = patientResult[0];
      if (!patient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Patient not found",
        });
      }

      const [records, visits] = await Promise.all([
        ctx.db
          .select()
          .from(medicalRecords)
          .where(
            and(
              eq(medicalRecords.patientId, input.patientId),
              eq(medicalRecords.createdBy, ctx.session.userId),
            ),
          )
          .orderBy(desc(medicalRecords.createdAt))
          .limit(50),
        ctx.db
          .select()
          .from(patientVisits)
          .where(
            and(
              eq(patientVisits.patientId, input.patientId),
              eq(patientVisits.providerId, ctx.session.userId),
            ),
          )
          .orderBy(desc(patientVisits.visitDate))
          .limit(50),
      ]);

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
        visits.map((v) => ({
          visitDate: v.visitDate,
          bpSystolic: v.bpSystolic,
          bpDiastolic: v.bpDiastolic,
          heartRate: v.heartRate,
          bslFasting: v.bslFasting,
          bslPostprandial: v.bslPostprandial,
          bslRandom: v.bslRandom,
          temperatureCelsius: v.temperatureCelsius,
          weightKg: v.weightKg,
          heightCm: v.heightCm,
          clinicalNotes: v.clinicalNotes,
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
        .where(
          and(
            eq(medicalRecords.id, input.recordId),
            eq(medicalRecords.createdBy, ctx.session.userId),
          ),
        )
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
        .where(
          and(
            eq(patients.id, record.patientId),
            eq(patients.createdBy, ctx.session.userId),
          ),
        )
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

  prescription: protectedProcedure
    .input(exportPrescriptionSchema)
    .mutation(async ({ ctx, input }) => {
      const [visit] = await ctx.db
        .select()
        .from(patientVisits)
        .where(
          and(
            eq(patientVisits.id, input.visitId),
            eq(patientVisits.providerId, ctx.session.userId),
          ),
        )
        .limit(1);
      if (!visit) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Visit not found" });
      }

      const [patient, doctor] = await Promise.all([
        ctx.db
          .select()
          .from(patients)
          .where(
            and(
              eq(patients.id, visit.patientId),
              eq(patients.createdBy, ctx.session.userId),
            ),
          )
          .limit(1)
          .then((rows) => rows[0]),
        ctx.db
          .select()
          .from(doctorProfiles)
          .where(eq(doctorProfiles.userId, ctx.session.userId))
          .limit(1)
          .then((rows) => rows[0]),
      ]);
      if (!patient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Patient not found",
        });
      }
      if (!doctor) {
        // The prescription header needs the doctor block. Surface the
        // missing-profile state to the UI so it can prompt the doctor
        // to complete Settings → Doctor Profile before printing.
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Doctor profile is incomplete — set it up in Settings before printing prescriptions.",
        });
      }

      const pdfBuffer = await renderPrescriptionPdf(
        {
          firstName: patient.firstName,
          middleName: patient.middleName,
          lastName: patient.lastName,
          dateOfBirth: patient.dateOfBirth,
          dobYear: patient.dobYear,
          gender: patient.gender,
          phone: patient.phone,
        },
        {
          fullName: doctor.fullName,
          qualification: doctor.qualification,
          specialization: doctor.specialization,
          registrationNumber: doctor.registrationNumber,
          mobileNumber: doctor.mobileNumber,
          email: doctor.email,
          clinicName: doctor.clinicName,
          taluka: doctor.taluka,
          district: doctor.district,
          state: doctor.state,
        },
        {
          visitDate: visit.visitDate,
          bpSystolic: visit.bpSystolic,
          bpDiastolic: visit.bpDiastolic,
          heartRate: visit.heartRate,
          weightKg: visit.weightKg,
          spO2Percent: visit.spO2Percent,
          clinicalNotes: visit.clinicalNotes,
        },
      );

      logAudit(ctx, {
        action: "export",
        resource: "prescription",
        resourceId: visit.id,
      });

      return {
        base64: pdfBuffer.toString("base64"),
        filename: `${patient.firstName}_${patient.lastName}_Rx_${visit.visitDate}.pdf`,
      };
    }),
});

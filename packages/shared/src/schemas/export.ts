import { z } from "zod";

export const exportPatientSummarySchema = z.object({
  patientId: z.string().uuid(),
});

export type ExportPatientSummary = z.infer<typeof exportPatientSummarySchema>;

export const exportMedicalRecordSchema = z.object({
  recordId: z.string().uuid(),
});

export type ExportMedicalRecord = z.infer<typeof exportMedicalRecordSchema>;

export const exportPrescriptionSchema = z.object({
  visitId: z.string().uuid(),
});

export type ExportPrescription = z.infer<typeof exportPrescriptionSchema>;

// Daily Case Register (Form 25) export — Manoj msg 1105. Renders the
// statutory register as a printer-friendly PDF for a date range. The
// caller picks startDate and endDate (inclusive, ISO YYYY-MM-DD); the
// frontend offers an FY shortcut that just expands to the right range.
export const exportDailyRegisterSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD"),
  })
  .refine((v) => v.startDate <= v.endDate, {
    message: "startDate must be on or before endDate",
    path: ["endDate"],
  });

export type ExportDailyRegister = z.infer<typeof exportDailyRegisterSchema>;

// Medical Fitness Certificate for Food Handlers (Manoj msg 2119). v1
// ships with this one template; the picker also lists Fitness Cert /
// Medical Leave Cert as disabled "coming soon" placeholders. Patient
// name / age / sex and doctor name / registration / clinic all
// pre-fill from the record + profile; the doctor only supplies the
// business-specific fields.
export const exportFoodHandlerCertificateSchema = z.object({
  patientId: z.string().uuid(),
  // Food establishment name — "Hotel/Restaurant Name" on the printed
  // form. Required.
  businessName: z.string().trim().min(1).max(200),
  // "M/s <employer>" — usually the same as the business name; the
  // client pre-fills it and lets the doctor override. Required so the
  // certificate paragraph isn't left with a blank slot.
  employerName: z.string().trim().min(1).max(200),
  // Examination date (YYYY-MM-DD). Defaults to today on the client.
  examDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "examDate must be YYYY-MM-DD"),
  // Place of examination — defaults to the doctor's clinic taluka on
  // the client so most certs need zero edits.
  place: z.string().trim().min(1).max(120),
  // Optional honorific override. Empty string on the wire → renders
  // the neutral "Shri/Smt./Miss" string on the PDF so the doctor can
  // circle in ink.
  honorific: z.enum(["Shri", "Smt.", "Miss", ""]).default(""),
});

export type ExportFoodHandlerCertificate = z.infer<
  typeof exportFoodHandlerCertificateSchema
>;

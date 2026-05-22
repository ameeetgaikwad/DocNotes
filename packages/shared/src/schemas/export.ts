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

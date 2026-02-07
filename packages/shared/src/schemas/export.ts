import { z } from "zod";

export const exportPatientSummarySchema = z.object({
  patientId: z.string().uuid(),
});

export type ExportPatientSummary = z.infer<typeof exportPatientSummarySchema>;

export const exportMedicalRecordSchema = z.object({
  recordId: z.string().uuid(),
});

export type ExportMedicalRecord = z.infer<typeof exportMedicalRecordSchema>;

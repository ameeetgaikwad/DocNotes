import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "visitDate must be YYYY-MM-DD");

const decimalString = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? String(v) : v))
  .pipe(z.string().regex(/^-?\d+(\.\d+)?$/, "must be numeric"));

export const patientVisitSchema = z.object({
  id: z.string().uuid(),
  providerId: z.string(),
  patientId: z.string().uuid(),
  visitDate: z.string(),
  bpSystolic: z.number().int().nullable(),
  bpDiastolic: z.number().int().nullable(),
  heartRate: z.number().int().nullable(),
  bslFasting: z.string().nullable(),
  bslPostprandial: z.string().nullable(),
  bslRandom: z.string().nullable(),
  temperatureCelsius: z.string().nullable(),
  weightKg: z.string().nullable(),
  heightCm: z.string().nullable(),
  spO2Percent: z.number().int().nullable(),
  clinicalNotes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type PatientVisit = z.infer<typeof patientVisitSchema>;

export const patientVisitListSchema = z.object({
  patientId: z.string().uuid(),
});

export type PatientVisitList = z.infer<typeof patientVisitListSchema>;

export const updatePatientVisitSchema = z.object({
  id: z.string().uuid(),
  data: z.object({
    bpSystolic: z.number().int().min(40).max(300).nullable().optional(),
    bpDiastolic: z.number().int().min(20).max(200).nullable().optional(),
    heartRate: z.number().int().min(20).max(300).nullable().optional(),
    bslFasting: decimalString.nullable().optional(),
    bslPostprandial: decimalString.nullable().optional(),
    bslRandom: decimalString.nullable().optional(),
    temperatureCelsius: decimalString.nullable().optional(),
    weightKg: decimalString.nullable().optional(),
    heightCm: decimalString.nullable().optional(),
    spO2Percent: z.number().int().min(50).max(100).nullable().optional(),
    clinicalNotes: z.string().max(20000).nullable().optional(),
  }),
});

export type UpdatePatientVisit = z.infer<typeof updatePatientVisitSchema>;

export const ensurePatientVisitSchema = z.object({
  patientId: z.string().uuid(),
  visitDate: isoDate,
});

export type EnsurePatientVisit = z.infer<typeof ensurePatientVisitSchema>;

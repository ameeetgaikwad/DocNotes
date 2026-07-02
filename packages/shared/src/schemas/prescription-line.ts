import { z } from "zod";

export const DOSAGE_PRESETS = [
  "1-0-0",
  "1-1-0",
  "1-0-1",
  "0-0-1",
  "1-1-1",
  "0-1-0",
  "0.5-0.5-0.5",
] as const;

export const DURATION_UNITS = ["days", "weeks", "months"] as const;
export type DurationUnit = (typeof DURATION_UNITS)[number];

export const MEAL_TIMINGS = ["before", "after"] as const;
export type MealTiming = (typeof MEAL_TIMINGS)[number];

export const prescriptionLineInputSchema = z.object({
  medicineName: z.string().trim().min(1).max(200),
  dosage: z.string().trim().max(100).nullable().optional(),
  // Meal timing rides on the existing "frequency" column so we don't
  // need another migration; the app-side value is constrained by
  // Zod but the DB column stays a free-form varchar for flexibility.
  frequency: z
    .enum(MEAL_TIMINGS)
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  duration: z.string().trim().max(50).nullable().optional(),
  quantity: z.number().int().positive().max(1000).nullable().optional(),
  instructions: z.string().trim().max(500).nullable().optional(),
});

export type PrescriptionLineInput = z.infer<typeof prescriptionLineInputSchema>;

export const upsertPrescriptionSchema = z.object({
  patientId: z.string().uuid(),
  // visitDate optional — if omitted, backend uses today's date
  // (Manoj msg 1947 B1 spec: Save creates today's visit).
  visitDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "visitDate must be YYYY-MM-DD")
    .optional(),
  lines: z.array(prescriptionLineInputSchema).max(30),
});

export type UpsertPrescriptionInput = z.infer<typeof upsertPrescriptionSchema>;

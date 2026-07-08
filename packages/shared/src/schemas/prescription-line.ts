import { z } from "zod";

// Detects medicine names that aren't tablets/capsules — used to
// suppress the misleading "N tabs" suffix in Clinical Notes and the
// "(Qty N)" suffix on the printed Rx (Manoj msg 2075 + 2080). Falls
// back to the tablet default when the name is ambiguous.
export const NON_TABLET_MEDICINE_REGEX = new RegExp(
  "\\b(susp|suspension|syr|syrup|drops?|inj|injection|cream|ointment|oint|gel|lotion|spray|liquid|solution|ml)\\b",
  "i",
);

export function isNonTabletMedicine(name: string): boolean {
  return NON_TABLET_MEDICINE_REGEX.test(name);
}

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

// Manoj msg 2112: ml volume for liquid meds ships without a schema
// change — we encode it into the existing duration varchar. Format:
//   "60 ml"                     — ml only, no treatment length
//   "3 days · 60 ml"            — both duration and ml
//   "3 days"                    — no ml (unchanged, back-compat)
// The " · Nml" suffix is the machine-parseable marker. Both the web
// editor and the PDF/notes renderer round-trip through these helpers.
const ML_SUFFIX_RE = /\s*·\s*(\d+)\s*ml\s*$/i;

export function parseDurationWithMl(duration: string | null | undefined): {
  duration: string | null;
  mlValue: number | null;
} {
  if (!duration) return { duration: null, mlValue: null };
  const trimmed = duration.trim();
  if (!trimmed) return { duration: null, mlValue: null };
  const suffix = ML_SUFFIX_RE.exec(trimmed);
  if (suffix) {
    const remaining = trimmed.slice(0, suffix.index).trim();
    return {
      duration: remaining || null,
      mlValue: Number(suffix[1]),
    };
  }
  // Ml-only rows are stored as "60 ml" (no "· " prefix, since there's
  // no days text to separate from). Detect that shape too.
  const mlOnly = /^(\d+)\s*ml$/i.exec(trimmed);
  if (mlOnly) {
    return { duration: null, mlValue: Number(mlOnly[1]) };
  }
  return { duration: trimmed, mlValue: null };
}

export function encodeDurationWithMl(
  duration: string | null | undefined,
  mlValue: number | null | undefined,
): string | null {
  const d = duration?.trim() || null;
  const ml = mlValue != null && Number.isFinite(mlValue) ? mlValue : null;
  if (d && ml != null) return `${d} · ${ml} ml`;
  if (ml != null) return `${ml} ml`;
  return d;
}

export const prescriptionLineInputSchema = z.object({
  // Server row id — present when the doctor is editing an existing
  // line, absent when they're adding a new one. Manoj msg 2081: the
  // backend uses this to diff (update/insert/delete) instead of
  // wiping the visit's Rx wholesale, so a second Rx session on the
  // same day accumulates instead of clobbering the first.
  id: z.string().uuid().optional(),
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

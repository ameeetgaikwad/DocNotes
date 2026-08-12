import { z } from "zod";

// Manoj msg 2595: the reason chip options in the form. Keep client
// and server on the same list; add new options here in one place.
export const CLINIC_HOLIDAY_REASONS = [
  "holiday",
  "personal_leave",
  "festival",
  "other",
] as const;

export type ClinicHolidayReason = (typeof CLINIC_HOLIDAY_REASONS)[number];

export const CLINIC_HOLIDAY_REASON_LABELS: Record<ClinicHolidayReason, string> =
  {
    holiday: "Holiday",
    personal_leave: "Personal Leave",
    festival: "Festival",
    other: "Other",
  };

// yyyy-mm-dd literal — matches the shape our date pickers hand back
// and what Postgres `date` columns expect for parameterised inserts.
const isoDateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");

export const upsertClinicHolidaySchema = z.object({
  id: z.string().uuid().optional(),
  holidayDate: isoDateStr,
  reason: z.enum(CLINIC_HOLIDAY_REASONS),
  note: z.string().trim().max(500).nullable().optional(),
});

export type UpsertClinicHoliday = z.infer<typeof upsertClinicHolidaySchema>;

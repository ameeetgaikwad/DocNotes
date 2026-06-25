import { z } from "zod";
import { initialVitalsSchema } from "./patient.js";

export const paymentModeSchema = z.enum(["cash", "digital"]);
export type PaymentMode = z.infer<typeof paymentModeSchema>;

export const paymentStatusSchema = z.enum(["paid", "due", "nil", "split"]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

// Split-payment validators (Manoj msg 1926). Used on create + update
// payloads to enforce: when paymentStatus === "split", all three
// amounts are present, non-negative, and sum exactly to feeAmount.
// When paymentStatus !== "split", all three must be omitted or null.
const splitAmount = z.number().nonnegative().max(1_000_000);

function validateSplitPayload(v: {
  paymentStatus?: PaymentStatus | null;
  feeAmount?: number;
  cashAmount?: number | null;
  digitalAmount?: number | null;
  balanceAmount?: number | null;
}): { ok: boolean; message?: string; path?: string } {
  const status = v.paymentStatus ?? null;
  const hasAny =
    v.cashAmount != null || v.digitalAmount != null || v.balanceAmount != null;
  if (status !== "split") {
    if (hasAny) {
      return {
        ok: false,
        message: "Split amounts only allowed when paymentStatus is 'split'",
        path: "paymentStatus",
      };
    }
    return { ok: true };
  }
  if (
    v.cashAmount == null ||
    v.digitalAmount == null ||
    v.balanceAmount == null
  ) {
    return {
      ok: false,
      message: "Split payment requires cash, digital, and balance",
      path: "cashAmount",
    };
  }
  if (v.feeAmount == null) {
    return {
      ok: false,
      message: "feeAmount required when splitting payment",
      path: "feeAmount",
    };
  }
  // Tolerate floating-point dust — round each to paisa and compare.
  const cents = (n: number) => Math.round(n * 100);
  const sum =
    cents(v.cashAmount) + cents(v.digitalAmount) + cents(v.balanceAmount);
  if (sum !== cents(v.feeAmount)) {
    return {
      ok: false,
      message:
        "Cash + Digital + Balance must equal Fee Amount exactly (₹ paisa).",
      path: "balanceAmount",
    };
  }
  return { ok: true };
}

export const SERVICE_TYPES = [
  "Consultation",
  "Follow-up",
  "Injection",
  "I.V.Fluids",
  "Home Visit / Domiciliary",
  "Procedure",
  "Vaccination",
  "Lab Test",
  "Diagnostic",
  "Dressing",
  "Ayurvedic Medicine",
  "Homeopathic Medicine",
  "Unani Medicine",
  "Referred to Specialist",
  "Other",
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const serviceTypeSchema = z.string().min(1).max(64);

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");

export const dailyRegisterEntrySchema = z.object({
  id: z.string().uuid(),
  providerId: z.string(),
  visitDate: z.string(),
  patientId: z.string().uuid(),
  serviceType: z.string().nullable(),
  feeAmount: z.string(),
  paidAmount: z.string(),
  paymentMode: paymentModeSchema,
  paymentStatus: paymentStatusSchema,
  cashAmount: z.string().nullable(),
  digitalAmount: z.string().nullable(),
  balanceAmount: z.string().nullable(),
  feeReceivedAt: z.string().nullable(),
  diagnosis: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type DailyRegisterEntry = z.infer<typeof dailyRegisterEntrySchema>;

export const createDailyRegisterEntrySchema = z
  .object({
    patientId: z.string().uuid(),
    visitDate: isoDate,
    serviceType: serviceTypeSchema.nullable().optional(),
    feeAmount: z.number().nonnegative().max(1_000_000),
    paymentMode: paymentModeSchema,
    paymentStatus: paymentStatusSchema.default("paid"),
    cashAmount: splitAmount.nullable().optional(),
    digitalAmount: splitAmount.nullable().optional(),
    balanceAmount: splitAmount.nullable().optional(),
    feeReceivedAt: isoDate.nullable().optional(),
    diagnosis: z.string().max(500).nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
    // Optional baseline vitals captured at the same time as the register
    // entry (unified register-entry + new-patient flow, Manoj msg 917).
    // Writes to today's patient_visits row after the entry is created.
    initialVitals: initialVitalsSchema.optional(),
  })
  .superRefine((v, ctx) => {
    const r = validateSplitPayload(v);
    if (!r.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: r.message ?? "invalid split payment",
        path: [r.path ?? "paymentStatus"],
      });
    }
  });

export type CreateDailyRegisterEntry = z.infer<
  typeof createDailyRegisterEntrySchema
>;

export const updateDailyRegisterEntrySchema = z
  .object({
    serviceType: serviceTypeSchema.nullable().optional(),
    feeAmount: z.number().nonnegative().max(1_000_000).optional(),
    paymentMode: paymentModeSchema.optional(),
    paymentStatus: paymentStatusSchema.optional(),
    cashAmount: splitAmount.nullable().optional(),
    digitalAmount: splitAmount.nullable().optional(),
    balanceAmount: splitAmount.nullable().optional(),
    feeReceivedAt: isoDate.nullable().optional(),
    diagnosis: z.string().max(500).nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    // Only validate when a split-related field changes; otherwise the
    // update is fine without revisiting payment shape.
    if (
      v.paymentStatus === "split" ||
      v.cashAmount != null ||
      v.digitalAmount != null ||
      v.balanceAmount != null
    ) {
      const r = validateSplitPayload(v);
      if (!r.ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: r.message ?? "invalid split payment",
          path: [r.path ?? "paymentStatus"],
        });
      }
    }
  });

export type UpdateDailyRegisterEntry = z.infer<
  typeof updateDailyRegisterEntrySchema
>;

export const dailyRegisterQuerySchema = z.object({
  visitDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "visitDate must be YYYY-MM-DD"),
});

export type DailyRegisterQuery = z.infer<typeof dailyRegisterQuerySchema>;

export const dailyRegisterSummaryQuerySchema = z
  .object({
    startDate: isoDate,
    endDate: isoDate,
  })
  .refine((v) => v.startDate <= v.endDate, {
    message: "startDate must be on or before endDate",
    path: ["startDate"],
  });

export type DailyRegisterSummaryQuery = z.infer<
  typeof dailyRegisterSummaryQuerySchema
>;

export const recordPaymentSchema = z.object({
  id: z.string().uuid(),
  paidAmount: z.number().nonnegative().max(1_000_000),
  feeReceivedAt: isoDate.nullable().optional(),
});

export type RecordPayment = z.infer<typeof recordPaymentSchema>;

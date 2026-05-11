import { z } from "zod";

export const paymentModeSchema = z.enum(["cash", "digital"]);
export type PaymentMode = z.infer<typeof paymentModeSchema>;

export const dailyRegisterEntrySchema = z.object({
  id: z.string().uuid(),
  providerId: z.string(),
  visitDate: z.string(),
  patientId: z.string().uuid(),
  feeAmount: z.string(),
  paymentMode: paymentModeSchema,
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type DailyRegisterEntry = z.infer<typeof dailyRegisterEntrySchema>;

export const createDailyRegisterEntrySchema = z.object({
  patientId: z.string().uuid(),
  visitDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "visitDate must be YYYY-MM-DD"),
  feeAmount: z.number().nonnegative().max(1_000_000),
  paymentMode: paymentModeSchema,
  notes: z.string().max(1000).nullable().optional(),
});

export type CreateDailyRegisterEntry = z.infer<
  typeof createDailyRegisterEntrySchema
>;

export const updateDailyRegisterEntrySchema = z.object({
  feeAmount: z.number().nonnegative().max(1_000_000).optional(),
  paymentMode: paymentModeSchema.optional(),
  notes: z.string().max(1000).nullable().optional(),
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

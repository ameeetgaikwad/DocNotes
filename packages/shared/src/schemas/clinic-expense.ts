import { z } from "zod";

export const DEFAULT_CLINIC_EXPENSE_CATEGORIES: ReadonlyArray<string> = [
  "Electricity Bill",
  "Staff Salary",
  "Medicine Purchase",
  "Rent",
  "Stationery",
  "Other",
];

export const PAYMENT_METHODS = ["cash", "digital"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const clinicExpenseSchema = z.object({
  id: z.string().uuid(),
  providerId: z.string(),
  amount: z.string(),
  categoryName: z.string(),
  expenseDate: z.string(),
  paidAt: z.coerce.date().nullable(),
  paymentMethod: z.enum(PAYMENT_METHODS).nullable(),
  staffName: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type ClinicExpense = z.infer<typeof clinicExpenseSchema>;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

export const createClinicExpenseSchema = z.object({
  amount: z
    .number()
    .positive("Amount must be greater than zero")
    .max(99999999.99, "Amount is too large"),
  categoryName: z
    .string()
    .trim()
    .min(1, "Category is required")
    .max(100, "Category must be 100 characters or fewer"),
  expenseDate: isoDate,
  paymentMethod: z.enum(PAYMENT_METHODS).nullable(),
  staffName: z
    .string()
    .trim()
    .max(100, "Staff name must be 100 characters or fewer")
    .nullable()
    .optional(),
  note: z
    .string()
    .trim()
    .max(500, "Note must be 500 characters or fewer")
    .nullable()
    .optional(),
});

export type CreateClinicExpense = z.infer<typeof createClinicExpenseSchema>;

export const updateClinicExpenseSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().positive().max(99999999.99).optional(),
  categoryName: z.string().trim().min(1).max(100).optional(),
  expenseDate: isoDate.optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).nullable().optional(),
  staffName: z.string().trim().max(100).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export type UpdateClinicExpense = z.infer<typeof updateClinicExpenseSchema>;

export const clinicExpenseCategorySchema = z.object({
  id: z.string().uuid(),
  providerId: z.string(),
  name: z.string(),
  createdAt: z.coerce.date(),
});

export type ClinicExpenseCategory = z.infer<typeof clinicExpenseCategorySchema>;

export const createClinicExpenseCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Category name is required")
    .max(100, "Category name must be 100 characters or fewer"),
});

export type CreateClinicExpenseCategory = z.infer<
  typeof createClinicExpenseCategorySchema
>;

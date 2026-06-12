import { z } from "zod";

export const homeopathicMedicineSchema = z.object({
  id: z.string().uuid(),
  providerId: z.string(),
  name: z.string(),
  potency: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type HomeopathicMedicine = z.infer<typeof homeopathicMedicineSchema>;

export const createHomeopathicMedicineSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(200, "Name must be 200 characters or fewer"),
  potency: z
    .string()
    .trim()
    .max(50, "Strength / Potency must be 50 characters or fewer")
    .nullable()
    .optional(),
  notes: z
    .string()
    .trim()
    .max(500, "Notes must be 500 characters or fewer")
    .nullable()
    .optional(),
});

export type CreateHomeopathicMedicine = z.infer<
  typeof createHomeopathicMedicineSchema
>;

export const updateHomeopathicMedicineSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  potency: z.string().trim().max(50).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export type UpdateHomeopathicMedicine = z.infer<
  typeof updateHomeopathicMedicineSchema
>;

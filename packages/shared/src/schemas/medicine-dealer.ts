import { z } from "zod";

const phoneRegex = /^(?:\+?\d[\d\s-]{6,30}\d)$/;

export const medicineDealerSchema = z.object({
  id: z.string().uuid(),
  providerId: z.string(),
  name: z.string(),
  phone: z.string(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type MedicineDealer = z.infer<typeof medicineDealerSchema>;

export const upsertMedicineDealerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Dealer name is required")
    .max(200, "Dealer name must be 200 characters or fewer"),
  phone: z.string().trim().regex(phoneRegex, "Enter a valid phone number"),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export type UpsertMedicineDealer = z.infer<typeof upsertMedicineDealerSchema>;

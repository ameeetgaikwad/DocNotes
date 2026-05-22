import { z } from "zod";

export const PURCHASE_CATEGORIES = [
  "medicine",
  "injection",
  "other",
  "reminder",
] as const;

export const purchaseCategorySchema = z.enum(PURCHASE_CATEGORIES);

export type PurchaseCategory = z.infer<typeof purchaseCategorySchema>;

export const purchaseItemSchema = z.object({
  id: z.string().uuid(),
  providerId: z.string(),
  text: z.string(),
  category: purchaseCategorySchema,
  isDone: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type PurchaseItem = z.infer<typeof purchaseItemSchema>;

export const createPurchaseItemSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Add some text for the item")
    .max(500, "Item text must be 500 characters or fewer"),
  category: purchaseCategorySchema.default("medicine"),
});

export type CreatePurchaseItem = z.infer<typeof createPurchaseItemSchema>;

export const updatePurchaseItemSchema = z.object({
  id: z.string().uuid(),
  text: z.string().trim().min(1).max(500).optional(),
  category: purchaseCategorySchema.optional(),
  isDone: z.boolean().optional(),
});

export type UpdatePurchaseItem = z.infer<typeof updatePurchaseItemSchema>;

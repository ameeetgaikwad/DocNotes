import { z } from "zod";

// Same permissive shape as medicine dealers — accepts "9850234103",
// "+919850234103", "91 9850234103", etc. Backend + client normalise
// to digits-only when building the wa.me URL.
const phoneRegex = /^(?:\+?\d[\d\s-]{6,30}\d)$/;

export const chemistSchema = z.object({
  id: z.string().uuid(),
  providerId: z.string(),
  name: z.string(),
  whatsappNumber: z.string(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Chemist = z.infer<typeof chemistSchema>;

export const upsertChemistSchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Chemist name is required")
    .max(200, "Chemist name must be 200 characters or fewer"),
  whatsappNumber: z
    .string()
    .trim()
    .regex(phoneRegex, "Enter a valid WhatsApp number"),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export type UpsertChemist = z.infer<typeof upsertChemistSchema>;

// Strip everything but digits (drop spaces, dashes, parens, leading +
// too — wa.me expects raw digits including the country code). If the
// caller didn't include a country code, prepend India's 91.
export function normalizeWhatsappNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  // Any Indian-format 10-digit number gets the 91 prefix so wa.me
  // routes correctly without needing the doctor to remember it.
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

import { z } from "zod";

export const homeVisitSchema = z.object({
  id: z.string().uuid(),
  providerId: z.string(),
  patientName: z.string(),
  scheduledAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
  note: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type HomeVisit = z.infer<typeof homeVisitSchema>;

export const createHomeVisitSchema = z.object({
  patientName: z
    .string()
    .trim()
    .min(1, "Patient name is required")
    .max(200, "Patient name must be 200 characters or fewer"),
  scheduledAt: z.coerce.date(),
  note: z
    .string()
    .trim()
    .max(500, "Note must be 500 characters or fewer")
    .nullable()
    .optional(),
});

export type CreateHomeVisit = z.infer<typeof createHomeVisitSchema>;

export const updateHomeVisitSchema = z.object({
  id: z.string().uuid(),
  patientName: z.string().trim().min(1).max(200).optional(),
  scheduledAt: z.coerce.date().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export type UpdateHomeVisit = z.infer<typeof updateHomeVisitSchema>;

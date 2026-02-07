import { z } from "zod";
import { AppointmentStatus, AppointmentType } from "../enums.js";

export const appointmentSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  providerId: z.string().uuid(),
  type: AppointmentType,
  status: AppointmentStatus,
  scheduledAt: z.coerce.date(),
  durationMinutes: z.number().int().positive().default(15),
  reason: z.string().max(500).nullable(),
  notes: z.string().nullable(),
  createdBy: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Appointment = z.infer<typeof appointmentSchema>;

export const createAppointmentSchema = z.object({
  patientId: z.string().uuid(),
  providerId: z.string().uuid(),
  type: AppointmentType,
  scheduledAt: z.coerce.date(),
  durationMinutes: z.number().int().positive().default(15),
  reason: z.string().max(500).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type CreateAppointment = z.infer<typeof createAppointmentSchema>;

export const updateAppointmentSchema = z.object({
  type: AppointmentType.optional(),
  status: AppointmentStatus.optional(),
  scheduledAt: z.coerce.date().optional(),
  durationMinutes: z.number().int().positive().optional(),
  reason: z.string().max(500).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type UpdateAppointment = z.infer<typeof updateAppointmentSchema>;

export const appointmentQuerySchema = z.object({
  providerId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  status: AppointmentStatus.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type AppointmentQuery = z.infer<typeof appointmentQuerySchema>;

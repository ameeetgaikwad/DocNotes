import { z } from "zod";
import { AllergySeverity, Gender } from "../enums.js";

export const allergySchema = z.object({
  name: z.string().min(1),
  severity: AllergySeverity,
  reaction: z.string().optional(),
});

export type Allergy = z.infer<typeof allergySchema>;

export const patientSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  dateOfBirth: z.coerce.date(),
  gender: Gender,
  email: z.string().email().nullable(),
  phone: z.string().max(20).nullable(),
  address: z.string().max(500).nullable(),
  emergencyContactName: z.string().max(255).nullable(),
  emergencyContactPhone: z.string().max(20).nullable(),
  bloodType: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
    .nullable(),
  allergies: z.array(allergySchema),
  activeConditions: z.array(z.string()),
  notes: z.string().nullable(),
  isActive: z.boolean(),
  createdBy: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Patient = z.infer<typeof patientSchema>;

export const createPatientSchema = z.object({
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  dateOfBirth: z.coerce.date(),
  gender: Gender,
  email: z.string().email().nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  emergencyContactName: z.string().max(255).nullable().optional(),
  emergencyContactPhone: z.string().max(20).nullable().optional(),
  bloodType: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
    .nullable()
    .optional(),
  allergies: z.array(allergySchema).optional(),
  activeConditions: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
});

export type CreatePatient = z.infer<typeof createPatientSchema>;

export const updatePatientSchema = createPatientSchema.partial();

export type UpdatePatient = z.infer<typeof updatePatientSchema>;

export const patientSearchSchema = z.object({
  query: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type PatientSearch = z.infer<typeof patientSearchSchema>;

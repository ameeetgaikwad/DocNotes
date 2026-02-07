import { z } from "zod";
import { RecordType } from "../enums.js";

export const soapNoteSchema = z.object({
  subjective: z.string().optional(),
  objective: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
});

export type SOAPNote = z.infer<typeof soapNoteSchema>;

export const vitalsSchema = z.object({
  bloodPressureSystolic: z.number().int().positive().optional(),
  bloodPressureDiastolic: z.number().int().positive().optional(),
  heartRate: z.number().int().positive().optional(),
  temperature: z.number().positive().optional(),
  weight: z.number().positive().optional(),
  height: z.number().positive().optional(),
  oxygenSaturation: z.number().min(0).max(100).optional(),
  respiratoryRate: z.number().int().positive().optional(),
});

export type Vitals = z.infer<typeof vitalsSchema>;

export const medicalRecordSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  type: RecordType,
  title: z.string().min(1).max(500),
  content: soapNoteSchema.nullable(),
  vitals: vitalsSchema.nullable(),
  diagnoses: z.array(z.string()),
  version: z.number().int().positive(),
  parentId: z.string().uuid().nullable(),
  createdBy: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type MedicalRecord = z.infer<typeof medicalRecordSchema>;

export const createMedicalRecordSchema = z.object({
  patientId: z.string().uuid(),
  type: RecordType,
  title: z.string().min(1).max(500),
  content: soapNoteSchema.nullable().optional(),
  vitals: vitalsSchema.nullable().optional(),
  diagnoses: z.array(z.string()).optional(),
});

export type CreateMedicalRecord = z.infer<typeof createMedicalRecordSchema>;

export const updateMedicalRecordSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: soapNoteSchema.nullable().optional(),
  vitals: vitalsSchema.nullable().optional(),
  diagnoses: z.array(z.string()).optional(),
});

export type UpdateMedicalRecord = z.infer<typeof updateMedicalRecordSchema>;

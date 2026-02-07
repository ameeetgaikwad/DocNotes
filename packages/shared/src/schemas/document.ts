import { z } from "zod";
import { DocumentCategory, DocumentStatus } from "../enums.js";

export const documentSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  medicalRecordId: z.string().uuid().nullable(),
  name: z.string().min(1).max(255),
  category: DocumentCategory,
  mimeType: z.string().max(100),
  sizeBytes: z.number().int().nonnegative(),
  s3Key: z.string().max(1024),
  status: DocumentStatus,
  notes: z.string().nullable(),
  uploadedBy: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Document = z.infer<typeof documentSchema>;

export const createDocumentSchema = z.object({
  patientId: z.string().uuid(),
  medicalRecordId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(255),
  category: DocumentCategory,
  mimeType: z.string().max(100),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024), // 10MB
  notes: z.string().nullable().optional(),
});

export type CreateDocument = z.infer<typeof createDocumentSchema>;

export const updateDocumentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  category: DocumentCategory.optional(),
  notes: z.string().nullable().optional(),
});

export type UpdateDocument = z.infer<typeof updateDocumentSchema>;

export const documentListSchema = z.object({
  patientId: z.string().uuid(),
  medicalRecordId: z.string().uuid().optional(),
  category: DocumentCategory.optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type DocumentList = z.infer<typeof documentListSchema>;

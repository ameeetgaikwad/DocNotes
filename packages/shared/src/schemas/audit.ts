import { z } from "zod";
import { AuditAction, AuditResource } from "../enums.js";

export const auditLogSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  action: AuditAction,
  resource: AuditResource,
  resourceId: z.string().uuid().nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export type AuditLog = z.infer<typeof auditLogSchema>;

export const auditQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  action: AuditAction.optional(),
  resource: AuditResource.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(50),
});

export type AuditQuery = z.infer<typeof auditQuerySchema>;

import { db } from "@docnotes/db";
import { auditLogs } from "@docnotes/db";
import type { AuditAction, AuditResource } from "@docnotes/shared";
import { logger } from "./logger.js";

interface AuditEntry {
  userId: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function logAuditEvent(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: entry.userId,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId ?? null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    });
  } catch (error) {
    // Never let audit logging failures break the request
    logger.error({ error, entry }, "Failed to write audit log");
  }
}

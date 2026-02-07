import { auditLogs } from "@docnotes/db";
import type { Context } from "../trpc.js";

interface AuditParams {
  action: string;
  resource: string;
  resourceId?: string | null;
}

/**
 * Log an audit event. Never throws — failures are silently swallowed
 * so audit logging can't break business logic.
 */
export async function logAudit(
  ctx: Context,
  params: AuditParams,
): Promise<void> {
  const userId = ctx.session?.userId;
  if (!userId) return;

  try {
    await ctx.db.insert(auditLogs).values({
      userId,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId ?? null,
      ipAddress: (ctx.req?.ip as string) ?? null,
      userAgent: (ctx.req?.headers?.["user-agent"] as string) ?? null,
    });
  } catch {
    // Never let audit logging break the request
  }
}

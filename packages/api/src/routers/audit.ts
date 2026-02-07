import { and, eq, gte, lte, desc } from "drizzle-orm";
import { auditLogs } from "@docnotes/db";
import { auditQuerySchema } from "@docnotes/shared";
import { adminProcedure, router } from "../trpc.js";

export const auditRouter = router({
  list: adminProcedure.input(auditQuerySchema).query(async ({ ctx, input }) => {
    const { userId, action, resource, from, to, page, limit } = input;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (userId) conditions.push(eq(auditLogs.userId, userId));
    if (action) conditions.push(eq(auditLogs.action, action));
    if (resource) conditions.push(eq(auditLogs.resource, resource));
    if (from) conditions.push(gte(auditLogs.createdAt, from));
    if (to) conditions.push(lte(auditLogs.createdAt, to));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await ctx.db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return { items, page, limit };
  }),
});

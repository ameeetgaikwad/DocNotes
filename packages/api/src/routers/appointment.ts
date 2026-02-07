import { z } from "zod";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { appointments } from "@docnotes/db";
import {
  createAppointmentSchema,
  updateAppointmentSchema,
  appointmentQuerySchema,
} from "@docnotes/shared";
import { protectedProcedure, router } from "../trpc.js";
import { logAudit } from "../lib/audit.js";

export const appointmentRouter = router({
  list: protectedProcedure
    .input(appointmentQuerySchema)
    .query(async ({ ctx, input }) => {
      const { providerId, patientId, status, from, to, page, limit } = input;
      const offset = (page - 1) * limit;

      const conditions = [];
      if (providerId) conditions.push(eq(appointments.providerId, providerId));
      if (patientId) conditions.push(eq(appointments.patientId, patientId));
      if (status) conditions.push(eq(appointments.status, status));
      if (from) conditions.push(gte(appointments.scheduledAt, from));
      if (to) conditions.push(lte(appointments.scheduledAt, to));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const items = await ctx.db
        .select()
        .from(appointments)
        .where(where)
        .orderBy(desc(appointments.scheduledAt))
        .limit(limit)
        .offset(offset);

      return { items, page, limit };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select()
        .from(appointments)
        .where(eq(appointments.id, input.id))
        .limit(1);

      return result[0] ?? null;
    }),

  create: protectedProcedure
    .input(createAppointmentSchema)
    .mutation(async ({ ctx, input }) => {
      const [appointment] = await ctx.db
        .insert(appointments)
        .values({
          ...input,
          createdBy: ctx.session.userId,
        })
        .returning();

      logAudit(ctx, {
        action: "create",
        resource: "appointment",
        resourceId: appointment!.id,
      });

      return appointment;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), data: updateAppointmentSchema }))
    .mutation(async ({ ctx, input }) => {
      const [appointment] = await ctx.db
        .update(appointments)
        .set(input.data)
        .where(eq(appointments.id, input.id))
        .returning();

      logAudit(ctx, {
        action: "update",
        resource: "appointment",
        resourceId: input.id,
      });

      return appointment;
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [appointment] = await ctx.db
        .update(appointments)
        .set({ status: "cancelled" })
        .where(eq(appointments.id, input.id))
        .returning();

      logAudit(ctx, {
        action: "delete",
        resource: "appointment",
        resourceId: input.id,
      });

      return appointment;
    }),
});

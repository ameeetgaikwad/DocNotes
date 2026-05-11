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
      const { patientId, status, from, to, page, limit } = input;
      const offset = (page - 1) * limit;

      const conditions = [eq(appointments.providerId, ctx.session.userId)];
      if (patientId) conditions.push(eq(appointments.patientId, patientId));
      if (status) conditions.push(eq(appointments.status, status));
      if (from) conditions.push(gte(appointments.scheduledAt, from));
      if (to) conditions.push(lte(appointments.scheduledAt, to));

      const items = await ctx.db
        .select()
        .from(appointments)
        .where(and(...conditions))
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
        .where(
          and(
            eq(appointments.id, input.id),
            eq(appointments.providerId, ctx.session.userId),
          ),
        )
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
        .where(
          and(
            eq(appointments.id, input.id),
            eq(appointments.providerId, ctx.session.userId),
          ),
        )
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
        .where(
          and(
            eq(appointments.id, input.id),
            eq(appointments.providerId, ctx.session.userId),
          ),
        )
        .returning();

      logAudit(ctx, {
        action: "delete",
        resource: "appointment",
        resourceId: input.id,
      });

      return appointment;
    }),
});

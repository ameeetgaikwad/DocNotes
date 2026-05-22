import { z } from "zod";
import { eq, and, gte, lte, desc, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { appointments, patients } from "@docnotes/db";
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

      const rows = await ctx.db
        .select({
          appointment: appointments,
          patient: {
            firstName: patients.firstName,
            middleName: patients.middleName,
            lastName: patients.lastName,
          },
        })
        .from(appointments)
        .innerJoin(patients, eq(patients.id, appointments.patientId))
        .where(and(...conditions))
        .orderBy(desc(appointments.scheduledAt))
        .limit(limit)
        .offset(offset);

      const items = rows.map((r) => ({ ...r.appointment, patient: r.patient }));
      return { items, page, limit };
    }),

  upcomingForReminders: protectedProcedure
    .input(
      z.object({
        daysAhead: z.number().int().min(0).max(60).default(7),
      }),
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const end = new Date(now);
      end.setUTCDate(end.getUTCDate() + input.daysAhead);
      const rows = await ctx.db
        .select({
          appointmentId: appointments.id,
          scheduledAt: appointments.scheduledAt,
          type: appointments.type,
          reason: appointments.reason,
          patientId: patients.id,
          firstName: patients.firstName,
          middleName: patients.middleName,
          lastName: patients.lastName,
          phone: patients.phone,
        })
        .from(appointments)
        .innerJoin(patients, eq(patients.id, appointments.patientId))
        .where(
          and(
            eq(appointments.providerId, ctx.session.userId),
            eq(appointments.status, "scheduled"),
            gte(appointments.scheduledAt, now),
            lte(appointments.scheduledAt, end),
          ),
        )
        .orderBy(asc(appointments.scheduledAt));
      return rows;
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
      const owned = await ctx.db
        .select({ id: patients.id })
        .from(patients)
        .where(
          and(
            eq(patients.id, input.patientId),
            eq(patients.createdBy, ctx.session.userId),
          ),
        )
        .limit(1);
      if (owned.length === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Patient not found",
        });
      }

      const [appointment] = await ctx.db
        .insert(appointments)
        .values({
          ...input,
          providerId: ctx.session.userId,
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

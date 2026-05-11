import { z } from "zod";
import { and, eq, ilike, or, desc, sql } from "drizzle-orm";
import { patients } from "@docnotes/db";
import {
  createPatientSchema,
  updatePatientSchema,
  patientSearchSchema,
  quickCreatePatientSchema,
} from "@docnotes/shared";
import { protectedProcedure, router } from "../trpc.js";
import { logAudit } from "../lib/audit.js";

export const patientRouter = router({
  list: protectedProcedure
    .input(patientSearchSchema)
    .query(async ({ ctx, input }) => {
      const { query, page, limit } = input;
      const offset = (page - 1) * limit;

      const ownership = and(
        eq(patients.isActive, true),
        eq(patients.createdBy, ctx.session.userId),
      );

      const where = query
        ? and(
            ownership,
            or(
              ilike(patients.firstName, `%${query}%`),
              ilike(patients.lastName, `%${query}%`),
              ilike(patients.email, `%${query}%`),
              ilike(patients.phone, `%${query}%`),
            ),
          )
        : ownership;

      const [items, countResult] = await Promise.all([
        ctx.db
          .select()
          .from(patients)
          .where(where)
          .orderBy(desc(patients.updatedAt))
          .limit(limit)
          .offset(offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(patients)
          .where(where),
      ]);

      return {
        items,
        total: Number(countResult[0]?.count ?? 0),
        page,
        limit,
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select()
        .from(patients)
        .where(
          and(
            eq(patients.id, input.id),
            eq(patients.createdBy, ctx.session.userId),
          ),
        )
        .limit(1);

      if (!result[0]) {
        return null;
      }
      return result[0];
    }),

  create: protectedProcedure
    .input(createPatientSchema)
    .mutation(async ({ ctx, input }) => {
      const [patient] = await ctx.db
        .insert(patients)
        .values({
          ...input,
          dateOfBirth: input.dateOfBirth.toISOString().split("T")[0]!,
          allergies: input.allergies ?? [],
          activeConditions: input.activeConditions ?? [],
          createdBy: ctx.session.userId,
        })
        .returning();

      logAudit(ctx, {
        action: "create",
        resource: "patient",
        resourceId: patient!.id,
      });

      return patient;
    }),

  quickCreate: protectedProcedure
    .input(quickCreatePatientSchema)
    .mutation(async ({ ctx, input }) => {
      const [patient] = await ctx.db
        .insert(patients)
        .values({
          firstName: input.firstName,
          lastName: input.lastName ?? "",
          createdBy: ctx.session.userId,
        })
        .returning();

      if (patient) {
        logAudit(ctx, {
          action: "create",
          resource: "patient",
          resourceId: patient.id,
        });
      }

      return patient;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), data: updatePatientSchema }))
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, unknown> = { ...input.data };
      if (input.data.dateOfBirth) {
        updateData.dateOfBirth = input.data.dateOfBirth
          .toISOString()
          .split("T")[0];
      }

      const [patient] = await ctx.db
        .update(patients)
        .set(updateData)
        .where(
          and(
            eq(patients.id, input.id),
            eq(patients.createdBy, ctx.session.userId),
          ),
        )
        .returning();

      logAudit(ctx, {
        action: "update",
        resource: "patient",
        resourceId: input.id,
      });

      return patient;
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [patient] = await ctx.db
        .update(patients)
        .set({ isActive: false })
        .where(
          and(
            eq(patients.id, input.id),
            eq(patients.createdBy, ctx.session.userId),
          ),
        )
        .returning();

      logAudit(ctx, {
        action: "delete",
        resource: "patient",
        resourceId: input.id,
      });

      return patient;
    }),
});

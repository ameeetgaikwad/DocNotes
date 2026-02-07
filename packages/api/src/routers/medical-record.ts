import { z } from "zod";
import { eq, desc, and, sql } from "drizzle-orm";
import { medicalRecords } from "@docnotes/db";
import {
  createMedicalRecordSchema,
  updateMedicalRecordSchema,
} from "@docnotes/shared";
import { protectedProcedure, router } from "../trpc.js";

export const medicalRecordRouter = router({
  listByPatient: protectedProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        type: z.string().optional(),
        page: z.number().int().positive().default(1),
        limit: z.number().int().positive().max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { patientId, type, page, limit } = input;
      const offset = (page - 1) * limit;

      const conditions = [eq(medicalRecords.patientId, patientId)];
      if (type) {
        conditions.push(eq(medicalRecords.type, type));
      }

      const where = conditions.length > 1 ? and(...conditions) : conditions[0]!;

      const [items, countResult] = await Promise.all([
        ctx.db
          .select()
          .from(medicalRecords)
          .where(where)
          .orderBy(desc(medicalRecords.createdAt))
          .limit(limit)
          .offset(offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(medicalRecords)
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
        .from(medicalRecords)
        .where(eq(medicalRecords.id, input.id))
        .limit(1);

      return result[0] ?? null;
    }),

  create: protectedProcedure
    .input(createMedicalRecordSchema)
    .mutation(async ({ ctx, input }) => {
      const [record] = await ctx.db
        .insert(medicalRecords)
        .values({
          ...input,
          content: input.content ?? null,
          vitals: input.vitals ?? null,
          diagnoses: input.diagnoses ?? [],
          createdBy: ctx.session.userId,
        })
        .returning();

      return record;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), data: updateMedicalRecordSchema }))
    .mutation(async ({ ctx, input }) => {
      // Medical records use append-only versioning:
      // Get the current record to base the new version on
      const [current] = await ctx.db
        .select()
        .from(medicalRecords)
        .where(eq(medicalRecords.id, input.id))
        .limit(1);

      if (!current) {
        return null;
      }

      // Create a new version with the updates
      const [record] = await ctx.db
        .insert(medicalRecords)
        .values({
          patientId: current.patientId,
          type: current.type,
          title: input.data.title ?? current.title,
          content:
            input.data.content !== undefined
              ? input.data.content
              : current.content,
          vitals:
            input.data.vitals !== undefined
              ? input.data.vitals
              : current.vitals,
          diagnoses: input.data.diagnoses ?? (current.diagnoses as string[]),
          version: (current.version ?? 1) + 1,
          parentId: current.id,
          createdBy: ctx.session.userId,
        })
        .returning();

      return record;
    }),
});

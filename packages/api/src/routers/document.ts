import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { documents } from "@docnotes/db";
import {
  createDocumentSchema,
  updateDocumentSchema,
  documentListSchema,
} from "@docnotes/shared";
import { protectedProcedure, router } from "../trpc.js";
import { logAudit } from "../lib/audit.js";
import {
  generateS3Key,
  createPresignedUploadUrl,
  createPresignedDownloadUrl,
  deleteS3Object,
} from "../lib/s3.js";

export const documentRouter = router({
  list: protectedProcedure
    .input(documentListSchema)
    .query(async ({ ctx, input }) => {
      const { patientId, medicalRecordId, category, page, limit } = input;
      const offset = (page - 1) * limit;

      const conditions = [eq(documents.patientId, patientId)];
      if (medicalRecordId) {
        conditions.push(eq(documents.medicalRecordId, medicalRecordId));
      }
      if (category) {
        conditions.push(eq(documents.category, category));
      }
      // Exclude uploading docs that are stale (not confirmed within an hour)
      conditions.push(
        sql`(${documents.status} != 'uploading' OR ${documents.createdAt} > now() - interval '1 hour')`,
      );

      const where = and(...conditions);

      const [items, countResult] = await Promise.all([
        ctx.db
          .select()
          .from(documents)
          .where(where)
          .orderBy(desc(documents.createdAt))
          .limit(limit)
          .offset(offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(documents)
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
        .from(documents)
        .where(eq(documents.id, input.id))
        .limit(1);

      return result[0] ?? null;
    }),

  requestUpload: protectedProcedure
    .input(createDocumentSchema)
    .mutation(async ({ ctx, input }) => {
      const s3Key = generateS3Key(input.patientId, input.name);

      const [doc] = await ctx.db
        .insert(documents)
        .values({
          patientId: input.patientId,
          medicalRecordId: input.medicalRecordId ?? null,
          name: input.name,
          category: input.category,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          s3Key,
          status: "uploading",
          notes: input.notes ?? null,
          uploadedBy: ctx.session.userId,
        })
        .returning();

      const uploadUrl = await createPresignedUploadUrl(
        s3Key,
        input.mimeType,
        input.sizeBytes,
      );

      logAudit(ctx, {
        action: "create",
        resource: "document",
        resourceId: doc!.id,
      });

      return {
        documentId: doc!.id,
        uploadUrl,
        s3Key,
      };
    }),

  confirmUpload: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [doc] = await ctx.db
        .update(documents)
        .set({ status: "active" })
        .where(
          and(eq(documents.id, input.id), eq(documents.status, "uploading")),
        )
        .returning();

      return doc ?? null;
    }),

  getDownloadUrl: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select()
        .from(documents)
        .where(and(eq(documents.id, input.id), eq(documents.status, "active")))
        .limit(1);

      const doc = result[0];
      if (!doc) return null;

      const url = await createPresignedDownloadUrl(doc.s3Key, doc.name);

      logAudit(ctx, {
        action: "read",
        resource: "document",
        resourceId: doc.id,
      });

      return { url, name: doc.name, mimeType: doc.mimeType };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), data: updateDocumentSchema }))
    .mutation(async ({ ctx, input }) => {
      const [doc] = await ctx.db
        .update(documents)
        .set(input.data)
        .where(eq(documents.id, input.id))
        .returning();

      logAudit(ctx, {
        action: "update",
        resource: "document",
        resourceId: input.id,
      });

      return doc;
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [doc] = await ctx.db
        .update(documents)
        .set({ status: "archived" })
        .where(eq(documents.id, input.id))
        .returning();

      logAudit(ctx, {
        action: "update",
        resource: "document",
        resourceId: input.id,
      });

      return doc;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .select()
        .from(documents)
        .where(eq(documents.id, input.id))
        .limit(1);

      const doc = result[0];
      if (!doc) return null;

      await deleteS3Object(doc.s3Key);
      await ctx.db.delete(documents).where(eq(documents.id, input.id));

      logAudit(ctx, {
        action: "delete",
        resource: "document",
        resourceId: input.id,
      });

      return { deleted: true };
    }),
});

import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { documents } from "@docnotes/db";
import {
  createDocumentSchema,
  updateDocumentSchema,
  documentListSchema,
  DOCUMENT_STORAGE_CAP_BYTES,
} from "@docnotes/shared";
import { protectedProcedure, router } from "../trpc.js";
import { logAudit } from "../lib/audit.js";
import {
  generateS3Key,
  createPresignedUploadUrl,
  createPresignedDownloadUrl,
  deleteS3Object,
} from "../lib/s3.js";

// Sum the current provider's active + uploading document sizes.
// Uploading rows are counted too so a doctor can't race multiple
// tab-opens to push past the cap. Shared by the usage query and the
// requestUpload cap check.
async function computeUsedBytes(
  db: import("@docnotes/db").Database,
  userId: string,
): Promise<number> {
  const [row] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${documents.sizeBytes}), 0)`,
    })
    .from(documents)
    .where(
      and(
        eq(documents.uploadedBy, userId),
        sql`${documents.status} <> 'archived'`,
      ),
    );
  // Postgres returns SUM as a numeric string — normalise to Number
  // here. 25 MB fits comfortably in safe-integer range.
  return Number(row?.total ?? 0);
}

export const documentRouter = router({
  list: protectedProcedure
    .input(documentListSchema)
    .query(async ({ ctx, input }) => {
      const { patientId, medicalRecordId, category, page, limit } = input;
      const offset = (page - 1) * limit;

      const conditions = [
        eq(documents.patientId, patientId),
        eq(documents.uploadedBy, ctx.session.userId),
      ];
      if (medicalRecordId) {
        conditions.push(eq(documents.medicalRecordId, medicalRecordId));
      }
      if (category) {
        conditions.push(eq(documents.category, category));
      }
      // Only return active documents — archive was replaced with hard
      // delete in Manoj msg 1077, but any pre-existing archived rows
      // should also be hidden so the list stays clean.
      conditions.push(eq(documents.status, "active"));

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
        .where(
          and(
            eq(documents.id, input.id),
            eq(documents.uploadedBy, ctx.session.userId),
          ),
        )
        .limit(1);

      return result[0] ?? null;
    }),

  // Manoj msg 2369: per-user storage usage. Powers the progress bar
  // and the tiered warnings (20/40/60/80%) in the Documents section.
  usage: protectedProcedure.query(async ({ ctx }) => {
    const usedBytes = await computeUsedBytes(ctx.db, ctx.session.userId);
    return {
      usedBytes,
      capBytes: DOCUMENT_STORAGE_CAP_BYTES,
      percentUsed: Math.min(
        100,
        Math.round((usedBytes / DOCUMENT_STORAGE_CAP_BYTES) * 100),
      ),
    };
  }),

  requestUpload: protectedProcedure
    .input(createDocumentSchema)
    .mutation(async ({ ctx, input }) => {
      // Cap enforcement (Manoj msg 2369). Add the incoming file size to
      // the current total and refuse if it would push past the cap.
      // Client-side image compression should keep most uploads well
      // under the ceiling; this is the last-line defence.
      const usedBytes = await computeUsedBytes(ctx.db, ctx.session.userId);
      if (usedBytes + input.sizeBytes > DOCUMENT_STORAGE_CAP_BYTES) {
        const capMb = Math.round(DOCUMENT_STORAGE_CAP_BYTES / (1024 * 1024));
        const usedMb = Math.round((usedBytes / (1024 * 1024)) * 10) / 10;
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message:
            `You've used ${usedMb} MB of your ${capMb} MB storage limit. ` +
            "Delete unused documents from other patients before uploading, " +
            "or ask the developer to enable a paid plan.",
        });
      }

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
          and(
            eq(documents.id, input.id),
            eq(documents.status, "uploading"),
            eq(documents.uploadedBy, ctx.session.userId),
          ),
        )
        .returning();

      return doc ?? null;
    }),

  getDownloadUrl: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        // "inline" → browser renders (View); "attachment" → forces save
        // (Download). Default "attachment" preserves the existing behaviour
        // for any other call sites that haven't been updated yet.
        disposition: z.enum(["attachment", "inline"]).default("attachment"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.id, input.id),
            eq(documents.status, "active"),
            eq(documents.uploadedBy, ctx.session.userId),
          ),
        )
        .limit(1);

      const doc = result[0];
      if (!doc) return null;

      const url = await createPresignedDownloadUrl(
        doc.s3Key,
        doc.name,
        input.disposition,
      );

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
        .where(
          and(
            eq(documents.id, input.id),
            eq(documents.uploadedBy, ctx.session.userId),
          ),
        )
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
        .where(
          and(
            eq(documents.id, input.id),
            eq(documents.uploadedBy, ctx.session.userId),
          ),
        )
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

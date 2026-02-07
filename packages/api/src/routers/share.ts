import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { shareLinks, patients, medicalRecords, documents } from "@docnotes/db";
import { createShareLinkSchema, accessShareLinkSchema } from "@docnotes/shared";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { protectedProcedure, publicProcedure, router } from "../trpc.js";
import { logAudit } from "../lib/audit.js";
import { renderPatientSummaryPdf, renderMedicalRecordPdf } from "../lib/pdf.js";
import { createPresignedDownloadUrl } from "../lib/s3.js";

export const shareRouter = router({
  create: protectedProcedure
    .input(createShareLinkSchema)
    .mutation(async ({ ctx, input }) => {
      const token = randomBytes(32).toString("hex"); // 64-char token
      const expiresAt = new Date(
        Date.now() + input.expiresInHours * 60 * 60 * 1000,
      );
      const passwordHash = input.password
        ? await bcrypt.hash(input.password, 12)
        : null;

      const [link] = await ctx.db
        .insert(shareLinks)
        .values({
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          token,
          expiresAt,
          passwordHash,
          maxAccesses: input.maxAccesses ?? null,
          createdBy: ctx.session.userId,
        })
        .returning();

      logAudit(ctx, {
        action: "share",
        resource: "share_link",
        resourceId: link!.id,
      });

      const webUrl = process.env.WEB_URL || "http://localhost:3000";

      return {
        id: link!.id,
        token,
        url: `${webUrl}/share/${token}`,
        expiresAt,
        hasPassword: !!passwordHash,
      };
    }),

  listByResource: protectedProcedure
    .input(
      z.object({
        resourceType: z.string(),
        resourceId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const items = await ctx.db
        .select({
          id: shareLinks.id,
          token: shareLinks.token,
          expiresAt: shareLinks.expiresAt,
          accessCount: shareLinks.accessCount,
          maxAccesses: shareLinks.maxAccesses,
          isRevoked: shareLinks.isRevoked,
          createdAt: shareLinks.createdAt,
          hasPassword: sql<boolean>`${shareLinks.passwordHash} IS NOT NULL`,
        })
        .from(shareLinks)
        .where(
          and(
            eq(shareLinks.resourceType, input.resourceType),
            eq(shareLinks.resourceId, input.resourceId),
          ),
        )
        .orderBy(desc(shareLinks.createdAt));

      return items;
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [link] = await ctx.db
        .update(shareLinks)
        .set({ isRevoked: true })
        .where(eq(shareLinks.id, input.id))
        .returning();

      logAudit(ctx, {
        action: "update",
        resource: "share_link",
        resourceId: input.id,
      });

      return link;
    }),

  access: publicProcedure
    .input(accessShareLinkSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .select()
        .from(shareLinks)
        .where(eq(shareLinks.token, input.token))
        .limit(1);

      const link = result[0];
      if (!link) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Share link not found",
        });
      }

      if (link.isRevoked) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This share link has been revoked",
        });
      }

      if (new Date() > link.expiresAt) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This share link has expired",
        });
      }

      if (link.maxAccesses && link.accessCount >= link.maxAccesses) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This share link has reached its access limit",
        });
      }

      if (link.passwordHash) {
        if (!input.password) {
          return { requiresPassword: true as const };
        }
        const valid = await bcrypt.compare(input.password, link.passwordHash);
        if (!valid) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Incorrect password",
          });
        }
      }

      // Increment access count
      await ctx.db
        .update(shareLinks)
        .set({ accessCount: sql`${shareLinks.accessCount} + 1` })
        .where(eq(shareLinks.id, link.id));

      // Generate the resource content
      if (
        link.resourceType === "patient_summary" ||
        link.resourceType === "medical_record"
      ) {
        let pdfBuffer: Buffer;
        let filename: string;

        if (link.resourceType === "patient_summary") {
          const patientResult = await ctx.db
            .select()
            .from(patients)
            .where(eq(patients.id, link.resourceId))
            .limit(1);

          const patient = patientResult[0];
          if (!patient) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Resource not found",
            });
          }

          const records = await ctx.db
            .select()
            .from(medicalRecords)
            .where(eq(medicalRecords.patientId, link.resourceId))
            .limit(50);

          pdfBuffer = await renderPatientSummaryPdf(
            {
              ...patient,
              allergies: (patient.allergies ?? []) as Array<{
                name: string;
                severity: string;
                reaction?: string;
              }>,
              activeConditions: (patient.activeConditions ?? []) as string[],
            },
            records.map((r) => ({
              title: r.title,
              type: r.type,
              createdAt: r.createdAt,
              content: r.content as {
                subjective?: string;
                objective?: string;
                assessment?: string;
                plan?: string;
              } | null,
              vitals: r.vitals as Record<string, number> | null,
              diagnoses: (r.diagnoses ?? []) as string[],
            })),
          );
          filename = `${patient.firstName}_${patient.lastName}_Summary.pdf`;
        } else {
          // medical_record
          const recordResult = await ctx.db
            .select()
            .from(medicalRecords)
            .where(eq(medicalRecords.id, link.resourceId))
            .limit(1);

          const record = recordResult[0];
          if (!record) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Resource not found",
            });
          }

          const patientResult = await ctx.db
            .select()
            .from(patients)
            .where(eq(patients.id, record.patientId))
            .limit(1);

          const patient = patientResult[0];
          if (!patient) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Resource not found",
            });
          }

          pdfBuffer = await renderMedicalRecordPdf(
            {
              ...patient,
              allergies: (patient.allergies ?? []) as Array<{
                name: string;
                severity: string;
                reaction?: string;
              }>,
              activeConditions: (patient.activeConditions ?? []) as string[],
            },
            {
              title: record.title,
              type: record.type,
              createdAt: record.createdAt,
              content: record.content as {
                subjective?: string;
                objective?: string;
                assessment?: string;
                plan?: string;
              } | null,
              vitals: record.vitals as Record<string, number> | null,
              diagnoses: (record.diagnoses ?? []) as string[],
            },
          );
          filename = `${patient.firstName}_${patient.lastName}_${record.title.replace(/\s+/g, "_")}.pdf`;
        }

        return {
          requiresPassword: false as const,
          type: "pdf" as const,
          base64: pdfBuffer.toString("base64"),
          filename,
        };
      }

      // document type — return S3 presigned URL
      if (link.resourceType === "document") {
        const docResult = await ctx.db
          .select()
          .from(documents)
          .where(eq(documents.id, link.resourceId))
          .limit(1);

        const doc = docResult[0];
        if (!doc) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Resource not found",
          });
        }

        const url = await createPresignedDownloadUrl(doc.s3Key, doc.name);

        return {
          requiresPassword: false as const,
          type: "redirect" as const,
          url,
          filename: doc.name,
        };
      }

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Unknown resource type",
      });
    }),
});

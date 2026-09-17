import { z } from "zod";
import { eq, and, desc, isNull, ne, sql, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { blogPosts } from "@docnotes/db";
import { upsertBlogPostSchema } from "@docnotes/shared";
import { adminProcedure, publicProcedure, router } from "../trpc.js";
import { logAudit } from "../lib/audit.js";

// Public marketing blog at cliniknote.app/blogs (Amit, 2026-09-17).
// Public procedures only ever return published, non-deleted posts.
// Mutations are admin-only. Same missing-table handling as the
// insight-notes router so a deploy that outruns migration 0029 shows
// an empty blog instead of a 500.

function isMissingTableError(err: unknown): boolean {
  if (!err) return false;
  const asAny = err as { code?: string; cause?: { code?: string } };
  if (asAny.code === "42P01" || asAny.cause?.code === "42P01") return true;
  const stringified = err instanceof Error ? err.message : String(err);
  return (
    stringified.includes("42P01") ||
    stringified.includes('relation "blog_posts" does not exist')
  );
}

function isUniqueViolation(err: unknown): boolean {
  const asAny = err as { code?: string; cause?: { code?: string } };
  return asAny?.code === "23505" || asAny?.cause?.code === "23505";
}

function friendlyDbError(err: unknown, verb: "save" | "delete"): never {
  if (isMissingTableError(err)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Blogs is being set up. Please try again in a few minutes — if the issue persists, tell the developer the database migration hasn't run.",
    });
  }
  if (isUniqueViolation(err)) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Another post already uses this slug. Pick a different one.",
    });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: `Could not ${verb} the post right now. Try again in a moment.`,
  });
}

const publishedFilter = and(
  eq(blogPosts.status, "published"),
  isNull(blogPosts.deletedAt),
);

// Columns for list views — skips the (potentially large) markdown body.
const summaryColumns = {
  id: blogPosts.id,
  slug: blogPosts.slug,
  title: blogPosts.title,
  excerpt: blogPosts.excerpt,
  authorName: blogPosts.authorName,
  coverImageUrl: blogPosts.coverImageUrl,
  status: blogPosts.status,
  publishedAt: blogPosts.publishedAt,
  updatedAt: blogPosts.updatedAt,
  viewCount: blogPosts.viewCount,
};

export const BLOG_PAGE_SIZE = 12;

export const blogRouter = router({
  // ── Public ────────────────────────────────────────────────────────

  list: publicProcedure
    .input(
      z
        .object({ page: z.number().int().min(1).max(1000).default(1) })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const page = input?.page ?? 1;
      try {
        const [posts, [total]] = await Promise.all([
          ctx.db
            .select(summaryColumns)
            .from(blogPosts)
            .where(publishedFilter)
            .orderBy(desc(blogPosts.publishedAt))
            .limit(BLOG_PAGE_SIZE)
            .offset((page - 1) * BLOG_PAGE_SIZE),
          ctx.db
            .select({ value: count() })
            .from(blogPosts)
            .where(publishedFilter),
        ]);
        const totalCount = Number(total?.value ?? 0);
        return {
          posts,
          page,
          totalPages: Math.max(1, Math.ceil(totalCount / BLOG_PAGE_SIZE)),
        };
      } catch (err) {
        if (isMissingTableError(err)) return { posts: [], page, totalPages: 1 };
        throw err;
      }
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string().trim().min(1).max(120) }))
    .query(async ({ ctx, input }) => {
      try {
        const [post] = await ctx.db
          .select()
          .from(blogPosts)
          .where(and(eq(blogPosts.slug, input.slug), publishedFilter))
          .limit(1);
        return post ?? null;
      } catch (err) {
        if (isMissingTableError(err)) return null;
        throw err;
      }
    }),

  // Slugs + last-modified for sitemap.xml.
  sitemapEntries: publicProcedure.query(async ({ ctx }) => {
    try {
      return await ctx.db
        .select({ slug: blogPosts.slug, updatedAt: blogPosts.updatedAt })
        .from(blogPosts)
        .where(publishedFilter)
        .orderBy(desc(blogPosts.publishedAt));
    } catch (err) {
      if (isMissingTableError(err)) return [];
      throw err;
    }
  }),

  // Fired once per page load from the post page. Pages are statically
  // cached, so the count can't be bumped during render.
  recordView: publicProcedure
    .input(z.object({ slug: z.string().trim().min(1).max(120) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db
          .update(blogPosts)
          .set({
            viewCount: sql`${blogPosts.viewCount} + 1`,
            // Don't let a view bump updatedAt (sitemap lastmod).
            updatedAt: sql`${blogPosts.updatedAt}`,
          })
          .where(and(eq(blogPosts.slug, input.slug), publishedFilter));
      } catch {
        // View counting is best-effort.
      }
      return { ok: true };
    }),

  // ── Admin ─────────────────────────────────────────────────────────

  adminList: adminProcedure.query(async ({ ctx }) => {
    try {
      return await ctx.db
        .select(summaryColumns)
        .from(blogPosts)
        .where(isNull(blogPosts.deletedAt))
        .orderBy(desc(blogPosts.updatedAt));
    } catch (err) {
      if (isMissingTableError(err)) return [];
      throw err;
    }
  }),

  adminGet: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const [post] = await ctx.db
          .select()
          .from(blogPosts)
          .where(and(eq(blogPosts.id, input.id), isNull(blogPosts.deletedAt)))
          .limit(1);
        return post ?? null;
      } catch (err) {
        if (isMissingTableError(err)) return null;
        throw err;
      }
    }),

  upsert: adminProcedure
    .input(upsertBlogPostSchema)
    .mutation(async ({ ctx, input }) => {
      const values = {
        slug: input.slug,
        title: input.title,
        excerpt: input.excerpt,
        content: input.content,
        authorName: input.authorName,
        coverImageUrl: input.coverImageUrl?.trim()
          ? input.coverImageUrl.trim()
          : null,
        status: input.status,
      };

      try {
        // Friendlier than waiting for the unique index to reject it.
        const [slugTaken] = await ctx.db
          .select({ id: blogPosts.id })
          .from(blogPosts)
          .where(
            and(
              eq(blogPosts.slug, input.slug),
              isNull(blogPosts.deletedAt),
              input.id ? ne(blogPosts.id, input.id) : undefined,
            ),
          )
          .limit(1);
        if (slugTaken) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Another post already uses this slug. Pick a different one.",
          });
        }

        if (input.id) {
          const [updated] = await ctx.db
            .update(blogPosts)
            .set({
              ...values,
              // First publish stamps the date; later edits keep it.
              publishedAt:
                input.status === "published"
                  ? sql`coalesce(${blogPosts.publishedAt}, now())`
                  : sql`${blogPosts.publishedAt}`,
            })
            .where(and(eq(blogPosts.id, input.id), isNull(blogPosts.deletedAt)))
            .returning();
          if (!updated) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "This post no longer exists.",
            });
          }
          logAudit(ctx, {
            action: "update",
            resource: "blog_post",
            resourceId: updated.id,
          });
          return updated;
        }

        const [created] = await ctx.db
          .insert(blogPosts)
          .values({
            ...values,
            publishedAt: input.status === "published" ? new Date() : null,
          })
          .returning();
        if (created) {
          logAudit(ctx, {
            action: "create",
            resource: "blog_post",
            resourceId: created.id,
          });
        }
        return created ?? null;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        return friendlyDbError(err, "save");
      }
    }),

  setStatus: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["draft", "published"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const [updated] = await ctx.db
          .update(blogPosts)
          .set({
            status: input.status,
            publishedAt:
              input.status === "published"
                ? sql`coalesce(${blogPosts.publishedAt}, now())`
                : sql`${blogPosts.publishedAt}`,
          })
          .where(and(eq(blogPosts.id, input.id), isNull(blogPosts.deletedAt)))
          .returning({ id: blogPosts.id, status: blogPosts.status });
        if (updated) {
          logAudit(ctx, {
            action: input.status === "published" ? "publish" : "unpublish",
            resource: "blog_post",
            resourceId: updated.id,
          });
        }
        return updated ?? null;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        return friendlyDbError(err, "save");
      }
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const [deleted] = await ctx.db
          .update(blogPosts)
          .set({ deletedAt: sql`now()` })
          .where(and(eq(blogPosts.id, input.id), isNull(blogPosts.deletedAt)))
          .returning({ id: blogPosts.id });
        if (deleted) {
          logAudit(ctx, {
            action: "delete",
            resource: "blog_post",
            resourceId: deleted.id,
          });
        }
        return deleted ?? null;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        return friendlyDbError(err, "delete");
      }
    }),
});

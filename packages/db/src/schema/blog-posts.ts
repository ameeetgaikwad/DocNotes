import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Public marketing blog at cliniknote.app/blogs (Amit, 2026-09-17).
// Authored by admins (Manoj) from the admin panel. Not tied to any
// doctor, so no provider FK. Content is markdown, rendered on the web
// app with react-markdown (raw HTML disabled). Soft delete per project
// policy.
export const blogPosts = pgTable(
  "blog_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 120 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    // ~160 chars. Doubles as the SEO meta description and og:description.
    excerpt: varchar("excerpt", { length: 300 }).notNull(),
    content: text("content").notNull(),
    authorName: varchar("author_name", { length: 120 })
      .notNull()
      .default("Manoj Gaikwad"),
    coverImageUrl: text("cover_image_url"),
    // "draft" | "published"
    status: varchar("status", { length: 16 }).notNull().default("draft"),
    // Stamped the first time a post is published; kept on unpublish so
    // re-publishing doesn't change the post's public date.
    publishedAt: timestamp("published_at", { withTimezone: true }),
    viewCount: integer("view_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    // Partial unique: a soft-deleted post frees its slug for reuse.
    uniqueIndex("blog_posts_slug_live_idx")
      .on(table.slug)
      .where(sql`${table.deletedAt} IS NULL`),
    index("blog_posts_status_published_at_idx").on(
      table.status,
      table.publishedAt,
    ),
  ],
);

export type BlogPost = typeof blogPosts.$inferSelect;
export type NewBlogPost = typeof blogPosts.$inferInsert;

-- Public marketing blog at cliniknote.app/blogs (Amit, 2026-09-17).
-- Authored by admins from the admin panel; markdown content. Not tied
-- to any doctor. Soft delete per project policy — the partial unique
-- index lets a deleted post's slug be reused.
CREATE TABLE IF NOT EXISTS "blog_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" varchar(120) NOT NULL,
  "title" varchar(200) NOT NULL,
  "excerpt" varchar(300) NOT NULL,
  "content" text NOT NULL,
  "author_name" varchar(120) DEFAULT 'Manoj Gaikwad' NOT NULL,
  "cover_image_url" text,
  "status" varchar(16) DEFAULT 'draft' NOT NULL,
  "published_at" timestamp with time zone,
  "view_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "blog_posts_slug_live_idx"
  ON "blog_posts" USING btree ("slug")
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "blog_posts_status_published_at_idx"
  ON "blog_posts" USING btree ("status", "published_at");

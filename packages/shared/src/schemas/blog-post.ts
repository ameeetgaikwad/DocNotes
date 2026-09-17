import { z } from "zod";

// Public marketing blog (Amit, 2026-09-17). Slugs are lowercase
// kebab-case so URLs stay clean: /blogs/how-cliniknote-works.
export const BLOG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const blogPostStatusSchema = z.enum(["draft", "published"]);
export type BlogPostStatus = z.infer<typeof blogPostStatusSchema>;

export const upsertBlogPostSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(120, "Slug must be 120 characters or fewer")
    .regex(
      BLOG_SLUG_PATTERN,
      "Slug can only use lowercase letters, numbers and single hyphens",
    ),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or fewer"),
  excerpt: z
    .string()
    .trim()
    .min(1, "Excerpt is required")
    .max(300, "Excerpt must be 300 characters or fewer"),
  content: z
    .string()
    .trim()
    .min(1, "Content is required")
    .max(100000, "Content must be 100,000 characters or fewer"),
  authorName: z
    .string()
    .trim()
    .min(1, "Author is required")
    .max(120, "Author must be 120 characters or fewer"),
  coverImageUrl: z
    .string()
    .trim()
    .url("Cover image must be a full URL")
    .refine((u) => /^https?:\/\//i.test(u), "Cover image must be http(s)")
    .nullable()
    .optional(),
  status: blogPostStatusSchema,
});

export type UpsertBlogPost = z.infer<typeof upsertBlogPostSchema>;

// "How ClinikNote Works!" -> "how-cliniknote-works"
export function slugifyBlogTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
}

import { trpcClient } from "@/lib/trpc";

// Server-side helpers for the public /blogs pages. Calls run without a
// Clerk token (trpcClient only attaches one in the browser), so they
// only ever see published posts.

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://cliniknote.app"
).replace(/\/+$/, "");

export async function fetchBlogList(page: number) {
  try {
    return await trpcClient.blog.list.query({ page });
  } catch (err) {
    // API unreachable during build shouldn't fail the whole deploy.
    console.error("[blog] list fetch failed", err);
    return { posts: [], page, totalPages: 1 };
  }
}

export async function fetchBlogPost(slug: string) {
  return trpcClient.blog.getBySlug.query({ slug });
}

export function formatBlogDate(date: Date | string | null | undefined) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

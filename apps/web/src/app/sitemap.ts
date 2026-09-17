import type { MetadataRoute } from "next";
import { trpcClient } from "@/lib/trpc";
import { SITE_URL } from "@/lib/blog";

export const revalidate = 3600;

const STATIC_ROUTES = [
  "",
  "/blogs",
  "/privacy",
  "/retention",
  "/terms",
  "/disclaimer",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${SITE_URL}${path}`,
  }));

  let posts: { slug: string; updatedAt: Date }[] = [];
  try {
    posts = await trpcClient.blog.sitemapEntries.query();
  } catch (err) {
    console.error("[sitemap] blog entries fetch failed", err);
  }

  return [
    ...staticEntries,
    ...posts.map((p) => ({
      url: `${SITE_URL}/blogs/${p.slug}`,
      lastModified: new Date(p.updatedAt),
    })),
  ];
}

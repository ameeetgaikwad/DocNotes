import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { BlogIndex } from "@/components/blog/BlogIndex";
import { SITE_URL, fetchBlogList } from "@/lib/blog";

export const revalidate = 60;

export function generateStaticParams() {
  return [];
}

function parsePage(raw: string): number | null {
  if (!/^\d{1,4}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 ? n : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}): Promise<Metadata> {
  const { page } = await params;
  return {
    title: `Blog — Page ${page} — ClinikNote`,
    alternates: { canonical: `${SITE_URL}/blogs/page/${page}` },
  };
}

export default async function BlogsPagedPage({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page: raw } = await params;
  const page = parsePage(raw);
  if (!page) notFound();
  if (page === 1) permanentRedirect("/blogs");

  const data = await fetchBlogList(page);
  if (page > data.totalPages) notFound();
  return <BlogIndex data={data} />;
}

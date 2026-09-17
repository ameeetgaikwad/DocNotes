import type { Metadata } from "next";
import { BlogIndex } from "@/components/blog/BlogIndex";
import { SITE_URL, fetchBlogList } from "@/lib/blog";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Blog — ClinikNote",
  description:
    "How ClinikNote works, tips for running a digital clinic register, and comparisons with other clinic tools.",
  alternates: { canonical: `${SITE_URL}/blogs` },
  openGraph: {
    type: "website",
    siteName: "ClinikNote",
    title: "ClinikNote Blog",
    url: `${SITE_URL}/blogs`,
  },
};

export default async function BlogsPage() {
  const data = await fetchBlogList(1);
  return <BlogIndex data={data} />;
}

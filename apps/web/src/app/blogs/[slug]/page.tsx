import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BlogShell } from "@/components/blog/BlogShell";
import { BlogMarkdown } from "@/components/blog/BlogMarkdown";
import { BlogViewTracker } from "@/components/blog/BlogViewTracker";
import { SITE_URL, fetchBlogPost, formatBlogDate } from "@/lib/blog";

export const revalidate = 60;

// Posts render on first request, then serve from the ISR cache.
export function generateStaticParams() {
  return [];
}

// generateMetadata + the page share one fetch per request.
const getPost = cache((slug: string) => fetchBlogPost(slug));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Post not found — ClinikNote" };

  const url = `${SITE_URL}/blogs/${post.slug}`;
  const images = post.coverImageUrl ? [{ url: post.coverImageUrl }] : [];
  return {
    title: `${post.title} — ClinikNote`,
    description: post.excerpt,
    authors: [{ name: post.authorName }],
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      siteName: "ClinikNote",
      url,
      title: post.title,
      description: post.excerpt,
      publishedTime: post.publishedAt
        ? new Date(post.publishedAt).toISOString()
        : undefined,
      modifiedTime: new Date(post.updatedAt).toISOString(),
      authors: [post.authorName],
      images,
    },
    twitter: {
      card: post.coverImageUrl ? "summary_large_image" : "summary",
      title: post.title,
      description: post.excerpt,
      images: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const url = `${SITE_URL}/blogs/${post.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    image: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    datePublished: post.publishedAt
      ? new Date(post.publishedAt).toISOString()
      : undefined,
    dateModified: new Date(post.updatedAt).toISOString(),
    author: { "@type": "Person", name: post.authorName },
    publisher: {
      "@type": "Organization",
      name: "ClinikNote",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icon.svg` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };

  return (
    <BlogShell>
      <script
        type="application/ld+json"
        // Escape "<" so post text can't close the script tag.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <BlogViewTracker slug={post.slug} />

      <Link href="/blogs" className="text-sm text-primary hover:underline">
        ← All posts
      </Link>

      <article className="mt-6">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          {post.title}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          By {post.authorName}
          {post.publishedAt && <> · {formatBlogDate(post.publishedAt)}</>}
        </p>

        {post.coverImageUrl && (
          <img
            src={post.coverImageUrl}
            alt=""
            className="mt-8 aspect-[16/9] w-full rounded-xl object-cover"
          />
        )}

        <div className="mt-8 text-base">
          <BlogMarkdown content={post.content} />
        </div>
      </article>

      <div className="mt-12 border-t pt-6">
        <Link href="/blogs" className="text-sm text-primary hover:underline">
          ← Back to all posts
        </Link>
      </div>
    </BlogShell>
  );
}

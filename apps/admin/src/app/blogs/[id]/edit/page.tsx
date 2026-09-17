"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { BlogEditor } from "@/components/BlogEditor";

export default function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const postQuery = useQuery(trpc.blog.adminGet.queryOptions({ id }));

  if (postQuery.isLoading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }
  if (postQuery.error || !postQuery.data) {
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground">
          {postQuery.error?.message ?? "This post doesn't exist."}
        </p>
        <Link href="/blogs" className="text-sm text-primary hover:underline">
          ← All posts
        </Link>
      </div>
    );
  }

  // key: remount the editor with fresh state once a save lands so the
  // "published" header + buttons reflect the saved status.
  const post = postQuery.data;
  return (
    <BlogEditor
      key={`${post.id}-${post.status}`}
      initial={{
        id: post.id,
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        authorName: post.authorName,
        coverImageUrl: post.coverImageUrl,
        status: post.status,
      }}
    />
  );
}

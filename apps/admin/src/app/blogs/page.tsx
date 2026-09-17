"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { trpc, trpcClient } from "@/lib/trpc";
import { formatRelative } from "@/lib/utils";

export default function BlogsPage() {
  const queryClient = useQueryClient();
  const postsQuery = useQuery(trpc.blog.adminList.queryOptions());

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.blog.adminList.queryKey(),
    });

  const setStatus = useMutation({
    mutationFn: (input: { id: string; status: "draft" | "published" }) =>
      trpcClient.blog.setStatus.mutate(input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => trpcClient.blog.delete.mutate({ id }),
    onSuccess: invalidate,
  });

  const actionError = setStatus.error?.message ?? remove.error?.message;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Blog posts
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Published posts appear on cliniknote.app/blogs within a minute.
          </p>
        </div>
        <Link
          href="/blogs/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          New post
        </Link>
      </div>

      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3 text-right">Views</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {postsQuery.isLoading && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Loading…
                </td>
              </tr>
            )}
            {postsQuery.data?.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No posts yet. Click &ldquo;New post&rdquo; to write the first
                  one.
                </td>
              </tr>
            )}
            {postsQuery.data?.map((post) => {
              const published = post.status === "published";
              const busy =
                (setStatus.isPending && setStatus.variables?.id === post.id) ||
                (remove.isPending && remove.variables === post.id);
              return (
                <tr key={post.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/blogs/${post.id}/edit`}
                      className="font-medium text-primary hover:underline"
                    >
                      {post.title}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground">
                      /blogs/{post.slug}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        published
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatRelative(post.updatedAt)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {post.viewCount}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <Link
                        href={`/blogs/${post.id}/edit`}
                        className="rounded-md border px-2.5 py-1 text-xs"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          const next = published ? "draft" : "published";
                          const msg = published
                            ? `Unpublish "${post.title}"? It will disappear from the website.`
                            : `Publish "${post.title}"? It will be visible to everyone.`;
                          if (window.confirm(msg)) {
                            setStatus.mutate({ id: post.id, status: next });
                          }
                        }}
                        className="rounded-md border px-2.5 py-1 text-xs disabled:opacity-50"
                      >
                        {published ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete "${post.title}"? This removes it from the website and the admin list.`,
                            )
                          ) {
                            remove.mutate(post.id);
                          }
                        }}
                        className="rounded-md border border-destructive/40 px-2.5 py-1 text-xs text-destructive disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

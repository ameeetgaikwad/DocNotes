"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  upsertBlogPostSchema,
  slugifyBlogTitle,
  type BlogPostStatus,
  type UpsertBlogPost,
} from "@docnotes/shared";
import { trpc, trpcClient } from "@/lib/trpc";

const WEB_URL = (
  process.env.NEXT_PUBLIC_WEB_URL || "https://cliniknote.app"
).replace(/\/+$/, "");

const DEFAULT_AUTHOR = "Manoj Gaikwad";
const EXCERPT_SEO_TARGET = 160;

export interface BlogEditorInitial {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  authorName: string;
  coverImageUrl: string | null;
  status: string;
}

const inputClass =
  "w-full rounded-md border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

export function BlogEditor({ initial }: { initial?: BlogEditorInitial }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  // New posts auto-derive the slug from the title until it's edited by
  // hand. Existing posts never auto-change — that would break live URLs.
  const [slugTouched, setSlugTouched] = useState(!!initial);
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [authorName, setAuthorName] = useState(
    initial?.authorName ?? DEFAULT_AUTHOR,
  );
  const [coverImageUrl, setCoverImageUrl] = useState(
    initial?.coverImageUrl ?? "",
  );
  const [content, setContent] = useState(initial?.content ?? "");
  const [mobileTab, setMobileTab] = useState<"write" | "preview">("write");
  const [errors, setErrors] = useState<string[]>([]);

  const wasPublished = initial?.status === "published";

  const save = useMutation({
    mutationFn: (input: UpsertBlogPost) => trpcClient.blog.upsert.mutate(input),
    onSuccess: async (post) => {
      await queryClient.invalidateQueries({
        queryKey: trpc.blog.adminList.queryKey(),
      });
      if (post && !initial) {
        router.replace(`/blogs/${post.id}/edit`);
      } else if (initial) {
        await queryClient.invalidateQueries({
          queryKey: trpc.blog.adminGet.queryKey({ id: initial.id }),
        });
      }
    },
    onError: (err) => setErrors([err.message]),
  });

  function submit(status: BlogPostStatus) {
    const parsed = upsertBlogPostSchema.safeParse({
      id: initial?.id,
      slug,
      title,
      excerpt,
      content,
      authorName,
      coverImageUrl: coverImageUrl.trim() || null,
      status,
    });
    if (!parsed.success) {
      save.reset();
      setErrors(parsed.error.issues.map((i) => i.message));
      return;
    }
    setErrors([]);
    save.mutate(parsed.data);
  }

  function onTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugifyBlogTitle(value));
  }

  const preview = (
    <div className="blog-markdown min-h-[24rem] rounded-md border bg-card p-4 text-sm sm:text-base">
      {content.trim() ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      ) : (
        <p className="text-muted-foreground">Preview appears here.</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/blogs"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← All posts
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {initial ? "Edit post" : "New post"}
          </h1>
          {initial && (
            <p className="mt-1 text-sm text-muted-foreground">
              {wasPublished ? (
                <>
                  Published ·{" "}
                  <a
                    href={`${WEB_URL}/blogs/${initial.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    View live
                  </a>{" "}
                  (changes show within a minute)
                </>
              ) : (
                "Draft — not visible on the website"
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {wasPublished ? (
            <>
              <button
                type="button"
                disabled={save.isPending}
                onClick={() => submit("draft")}
                className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
              >
                Unpublish
              </button>
              <button
                type="button"
                disabled={save.isPending}
                onClick={() => submit("published")}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {save.isPending ? "Saving…" : "Save changes"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={save.isPending}
                onClick={() => submit("draft")}
                className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
              >
                {save.isPending ? "Saving…" : "Save draft"}
              </button>
              <button
                type="button"
                disabled={save.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      "Publish this post? It will be visible to everyone on the website.",
                    )
                  ) {
                    submit("published");
                  }
                }}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Publish
              </button>
            </>
          )}
        </div>
      </div>

      {errors.length > 0 && (
        <ul className="list-disc space-y-1 rounded-md border border-destructive/40 bg-destructive/10 py-3 pl-8 pr-4 text-sm text-destructive">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {save.isSuccess && errors.length === 0 && (
        <p className="text-sm text-primary">Saved.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm font-medium">Title</span>
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            maxLength={200}
            placeholder="How ClinikNote works"
            className={inputClass}
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium">URL slug</span>
          <input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
            maxLength={120}
            placeholder="how-cliniknote-works"
            className={`${inputClass} font-mono`}
          />
          <span className="block text-xs text-muted-foreground">
            {WEB_URL}/blogs/{slug || "…"}
            {wasPublished && slug !== initial?.slug && (
              <span className="text-destructive">
                {" "}
                — changing this breaks links already shared
              </span>
            )}
          </span>
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium">Author</span>
          <input
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            maxLength={120}
            className={inputClass}
          />
        </label>

        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm font-medium">
            Excerpt{" "}
            <span className="font-normal text-muted-foreground">
              (shown in the post list and Google results)
            </span>
          </span>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            maxLength={300}
            rows={2}
            className={inputClass}
          />
          <span
            className={`block text-xs ${
              excerpt.length > EXCERPT_SEO_TARGET
                ? "text-warning"
                : "text-muted-foreground"
            }`}
          >
            {excerpt.length}/{EXCERPT_SEO_TARGET} characters recommended
          </span>
        </label>

        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm font-medium">
            Cover image URL{" "}
            <span className="font-normal text-muted-foreground">
              (optional, landscape works best)
            </span>
          </span>
          <input
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            placeholder="https://…"
            className={inputClass}
          />
          {/^https?:\/\//i.test(coverImageUrl.trim()) && (
            <img
              src={coverImageUrl.trim()}
              alt="Cover preview"
              className="mt-2 aspect-[16/9] w-full max-w-sm rounded-md border object-cover"
            />
          )}
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Content (Markdown)</span>
          <div className="flex rounded-md border text-xs lg:hidden">
            {(["write", "preview"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setMobileTab(tab)}
                className={`px-3 py-1 capitalize ${
                  mobileTab === tab ? "bg-muted font-medium" : ""
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Markdown cheatsheet</summary>
          <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 font-mono">
            {`## Heading      ### Smaller heading
**bold**        *italic*
- bullet item   1. numbered item
[link text](https://example.com)
![image description](https://image-url)
> quote
| Column | Column |
|--------|--------|
| cell   | cell   |`}
          </pre>
        </details>
        <div className="grid gap-4 lg:grid-cols-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={24}
            placeholder="Write your post in Markdown…"
            className={`${inputClass} min-h-[24rem] font-mono ${
              mobileTab === "write" ? "" : "hidden lg:block"
            }`}
          />
          <div className={mobileTab === "preview" ? "" : "hidden lg:block"}>
            {preview}
          </div>
        </div>
      </div>
    </div>
  );
}

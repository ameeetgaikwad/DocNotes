import Link from "next/link";
import { BlogShell } from "@/components/blog/BlogShell";
import { formatBlogDate } from "@/lib/blog";
import type { fetchBlogList } from "@/lib/blog";

type BlogListResult = Awaited<ReturnType<typeof fetchBlogList>>;

function pageHref(page: number) {
  return page <= 1 ? "/blogs" : `/blogs/page/${page}`;
}

export function BlogIndex({ data }: { data: BlogListResult }) {
  const { posts, page, totalPages } = data;

  return (
    <BlogShell wide>
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          ClinikNote Blog
        </h1>
        <p className="mt-2 text-muted-foreground">
          How ClinikNote works, tips for running a digital clinic register, and
          how we compare with other tools.
        </p>
      </div>

      {posts.length === 0 ? (
        <p className="mt-12 text-muted-foreground">
          No posts yet — check back soon.
        </p>
      ) : (
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                href={`/blogs/${post.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md"
              >
                <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
                  {post.coverImageUrl ? (
                    // External, admin-pasted URLs — next/image would need
                    // every host allow-listed, so use a plain <img>.
                    <img
                      src={post.coverImageUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-primary/10 text-2xl font-semibold text-primary">
                      ClinikNote
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-xs text-muted-foreground">
                    {formatBlogDate(post.publishedAt)}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold leading-snug group-hover:text-primary">
                    {post.title}
                  </h2>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                    {post.excerpt}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav
          aria-label="Blog pages"
          className="mt-10 flex items-center justify-between text-sm"
        >
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="text-primary hover:underline"
            >
              ← Newer posts
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(page + 1)}
              className="text-primary hover:underline"
            >
              Older posts →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </BlogShell>
  );
}

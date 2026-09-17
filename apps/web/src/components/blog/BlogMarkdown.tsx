import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Raw HTML in the markdown is NOT rendered (no rehype-raw), and
// react-markdown's default urlTransform strips javascript: links, so
// post content can't inject scripts.
export function BlogMarkdown({ content }: { content: string }) {
  return (
    <div className="blog-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const external = !!href && /^https?:\/\//i.test(href);
            return (
              <a
                href={href}
                {...(external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { trpcClient } from "@/lib/trpc";

// Post pages are statically cached, so views are counted from the
// browser. Fire-and-forget; failures are ignored.
export function BlogViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    trpcClient.blog.recordView.mutate({ slug }).catch(() => {});
  }, [slug]);
  return null;
}

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Page-level header used inside `MobilePage`. On mobile it's a compact row
 * with optional back-chevron link, title, and an optional trailing action
 * (e.g. an icon button or a New CTA on desktop where there's room). Desktop
 * gets the same content with a bit more vertical room.
 */
export function PageHeader({
  title,
  subtitle,
  backHref,
  backLabel = "Back",
  action,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-4 md:mb-6", className)}>
      {backHref && (
        <Link
          href={backHref}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold leading-tight md:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-sm text-muted-foreground md:text-base">
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}

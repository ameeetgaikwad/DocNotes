"use client";

import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  isLoading,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  isLoading?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs uppercase tracking-wide sm:text-sm">
          {label}
        </span>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums sm:text-3xl">
        {isLoading ? "—" : value}
      </p>
    </div>
  );
}

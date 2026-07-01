"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PenLine, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatPatientName, formatPatientAgeDob } from "@/lib/format";
import { useDebounce } from "@/hooks/use-debounce";

// Manoj msg 1947 A2: replace the non-functional "Records This Week"
// tile with a prominent Write Rx call-to-action + a patient search box.
// Selecting a patient opens /prescribe/[id] in a full-screen editor.
export function WriteRxCallout() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 250);
  const trimmed = debounced.trim();

  const patientsQuery = useQuery({
    ...trpc.patient.list.queryOptions({
      query: trimmed || undefined,
      page: 1,
      limit: 6,
    }),
    enabled: trimmed.length > 0,
  });

  const rows = useMemo(
    () => patientsQuery.data?.items ?? [],
    [patientsQuery.data],
  );

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <PenLine className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
        <h3 className="text-sm font-semibold sm:text-base">Write Rx</h3>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
        Quickly prescribe for an existing patient.
      </p>
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search patient by name or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border bg-background py-2 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {trimmed && (
        <div className="mt-2 max-h-56 overflow-y-auto rounded-md border">
          {patientsQuery.isLoading && (
            <div className="p-3 text-xs text-muted-foreground">Searching…</div>
          )}
          {!patientsQuery.isLoading && rows.length === 0 && (
            <div className="p-3 text-xs text-muted-foreground">No matches.</div>
          )}
          {rows.map((p) => {
            const { age } = formatPatientAgeDob(p);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => router.push(`/prescribe/${p.id}`)}
                className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-accent"
              >
                <span className="font-medium">{formatPatientName(p)}</span>
                <span className="text-xs text-muted-foreground">
                  {age != null ? `${age} y` : ""}
                  {p.phone ? ` · ${p.phone}` : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

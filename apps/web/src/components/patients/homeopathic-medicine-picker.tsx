"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Pill } from "lucide-react";
import type { HomeopathicMedicine } from "@docnotes/shared";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogClose as DialogClose,
} from "@/components/ui/responsive-dialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onInsert: (lines: string[]) => void;
}

export function HomeopathicMedicinePicker({
  open,
  onOpenChange,
  onInsert,
}: Props) {
  const listQuery = useQuery({
    ...trpc.homeopathicMedicine.list.queryOptions(),
    enabled: open,
  });

  const items = useMemo<HomeopathicMedicine[]>(
    () => (listQuery.data ?? []) as HomeopathicMedicine[],
    [listQuery.data],
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setFilter("");
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.potency ?? "").toLowerCase().includes(q) ||
        (m.notes ?? "").toLowerCase().includes(q),
    );
  }, [items, filter]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleInsert() {
    const lines = items
      .filter((m) => selected.has(m.id))
      .map((m) => (m.potency ? `${m.name} ${m.potency}` : m.name));
    if (lines.length > 0) onInsert(lines);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          {/* Manoj msg 1818: keep the Insert button at the bottom but
              ALSO mirror it at the top-right so a doctor who scrolled
              through a long list doesn't need to scroll back down to
              hit Insert. The pr-8 reserves space for the dialog's
              own close X (positioned absolutely in the top-right by
              ResponsiveDialog). */}
          <div className="flex items-start justify-between gap-2 pr-8">
            <div className="min-w-0 flex-1">
              <DialogTitle>Insert medicine</DialogTitle>
              <DialogDescription>
                Pick one or more medicines to append to the Plan field. Works
                for homeopathic, ayurvedic, unani, and allopathic — whatever
                you&apos;ve saved.
              </DialogDescription>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleInsert}
              disabled={selected.size === 0}
            >
              Insert {selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
          </div>
        </DialogHeader>

        {listQuery.isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!listQuery.isLoading && items.length === 0 && (
          <div className="rounded-md border border-dashed bg-muted/40 p-4 text-sm">
            <div className="mb-2 flex items-center gap-2 text-muted-foreground">
              <Pill className="h-4 w-4" />
              <span>No medicines saved yet.</span>
            </div>
            <p className="text-muted-foreground">
              Add some in{" "}
              <Link
                href="/homeopathic-medicine"
                className="text-primary hover:underline"
                onClick={() => onOpenChange(false)}
              >
                More → Medicines
              </Link>
              .
            </p>
          </div>
        )}

        {!listQuery.isLoading && items.length > 0 && (
          <div className="space-y-3">
            <Input
              type="search"
              placeholder="Filter…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              autoFocus
            />
            <ul className="max-h-72 divide-y overflow-y-auto rounded-md border">
              {filtered.length === 0 && (
                <li className="px-3 py-3 text-sm text-muted-foreground">
                  No matches.
                </li>
              )}
              {filtered.map((m) => {
                const checked = selected.has(m.id);
                return (
                  <li key={m.id}>
                    <label className="flex cursor-pointer items-start gap-3 px-3 py-3 text-sm hover:bg-accent">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(m.id)}
                        className="mt-1 h-4 w-4 cursor-pointer accent-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {m.name}
                          {m.potency && (
                            <>
                              {" "}
                              <span className="text-muted-foreground">
                                {m.potency}
                              </span>
                            </>
                          )}
                        </p>
                        {m.notes && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {m.notes}
                          </p>
                        )}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleInsert}
            disabled={selected.size === 0}
          >
            Insert {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

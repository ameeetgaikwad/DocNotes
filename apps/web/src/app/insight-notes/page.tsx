"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Trash2,
  Loader2,
  Lightbulb,
  ChevronRight,
  X,
} from "lucide-react";
import { trpc, trpcClient } from "@/lib/trpc";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from "@/components/ui/responsive-dialog";

// Small debounce for the search box so we don't hammer the router on
// every keystroke. Kept inline because this is the only place we need
// it here.
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useMemo(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

type NoteRow = {
  id: string;
  title: string | null;
  body: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export default function InsightNotesPage() {
  const queryClient = useQueryClient();
  const [rawQuery, setRawQuery] = useState("");
  const query = useDebounced(rawQuery.trim(), 200);
  const listQuery = useQuery(
    trpc.insightNote.list.queryOptions(
      query.length > 0 ? { query } : undefined,
    ),
  );
  const [editing, setEditing] = useState<NoteRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: NoteRow) {
    setEditing(row);
    setFormOpen(true);
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => trpcClient.insightNote.delete.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["insightNote"]] });
    },
  });

  function handleDelete(row: NoteRow) {
    // Soft delete per Manoj msg 2597 — recoverable in principle, but
    // no "Recently Deleted" view yet, so still confirm.
    const label = row.title?.trim() || row.body.slice(0, 50);
    if (window.confirm(`Delete "${label}"?`)) {
      deleteMutation.mutate(row.id);
    }
  }

  const rows = (listQuery.data ?? []) as NoteRow[];

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <PageHeader
        title="Insight Notes"
        subtitle="Personal clinical observations, reading takeaways, disease insights."
        backHref="/"
        backLabel="Back to Dashboard"
        action={
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4" />
            New note
          </Button>
        }
      />

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          placeholder="Search title or body..."
          className="pl-9 pr-9"
        />
        {rawQuery && (
          <button
            type="button"
            onClick={() => setRawQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="rounded-xl border bg-card">
        {listQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <Lightbulb className="h-10 w-10 opacity-40" />
            <p className="text-base font-medium">
              {query.length > 0 ? "No notes match your search" : "No notes yet"}
            </p>
            {query.length === 0 && (
              <>
                <p className="text-sm">
                  Jot down observations, reading takeaways, or anything worth
                  keeping around.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={openNew}
                >
                  <Plus className="h-4 w-4" />
                  Write your first note
                </Button>
              </>
            )}
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => openEdit(row)}
                  className="flex w-full items-start gap-3 px-4 py-4 text-left transition active:bg-muted/40 sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="font-semibold">
                        {row.title?.trim() || "Untitled note"}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(row.updatedAt)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-muted-foreground">
                      {row.body}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-center gap-1">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(row);
                    }}
                    disabled={deleteMutation.isPending}
                    className="rounded-md p-1.5 text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <InsightNoteFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
      />
    </div>
  );
}

function InsightNoteFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: NoteRow | null;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [body, setBody] = useState(editing?.body ?? "");
  const [error, setError] = useState<string | null>(null);

  const seedKey = editing?.id ?? "new";
  const [lastSeed, setLastSeed] = useState<string | null>(null);
  if (open && lastSeed !== seedKey) {
    setTitle(editing?.title ?? "");
    setBody(editing?.body ?? "");
    setError(null);
    setLastSeed(seedKey);
  }
  if (!open && lastSeed !== null) {
    setLastSeed(null);
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      trpcClient.insightNote.upsert.mutate({
        id: editing?.id,
        title: title.trim() ? title.trim() : null,
        body: body.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["insightNote"]] });
      onOpenChange(false);
    },
    onError: (err) => setError(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit note" : "New note"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="note-title">Title (optional)</Label>
            <Input
              id="note-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Amiodarone side effects"
              maxLength={200}
            />
          </div>
          <div>
            <Label htmlFor="note-body">Note</Label>
            <Textarea
              id="note-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your observation, insight, or reading takeaway..."
              rows={8}
              maxLength={10000}
              className="resize-y"
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {body.length}/10,000
            </p>
          </div>
          {error && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || body.trim().length === 0}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving
                </>
              ) : editing ? (
                "Save changes"
              ) : (
                "Save note"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

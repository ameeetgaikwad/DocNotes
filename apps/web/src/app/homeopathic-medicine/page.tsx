"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Pill, Plus, Trash2 } from "lucide-react";
import type { HomeopathicMedicine } from "@docnotes/shared";
import { trpc, trpcClient } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogClose as DialogClose,
} from "@/components/ui/responsive-dialog";

export default function HomeopathicMedicinePage() {
  const queryClient = useQueryClient();
  const listQuery = useQuery(trpc.homeopathicMedicine.list.queryOptions());

  const [editing, setEditing] = useState<HomeopathicMedicine | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const items = (listQuery.data ?? []) as HomeopathicMedicine[];

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      trpcClient.homeopathicMedicine.delete.mutate({ id }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [["homeopathicMedicine"]] }),
  });

  const [seedFeedback, setSeedFeedback] = useState<string | null>(null);

  const seedMutation = useMutation({
    mutationFn: () => trpcClient.homeopathicMedicine.seedDefaults.mutate(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [["homeopathicMedicine"]] });
      setSeedFeedback(
        result.inserted > 0
          ? `Added ${result.inserted} medicine${result.inserted === 1 ? "" : "s"} from the suggested list.`
          : "All suggested defaults are already in your list.",
      );
    },
  });

  // Auto-seed only on the doctor's first ever visit to this page
  // (Manoj msg 854 wanted the defaults to "just appear" the first
  // time; Amit review msg 1097 P2 then flagged that the previous
  // implementation re-seeded after a delete-all). The backend's
  // seedDefaultsIfFirstUse no-ops when a prior seed_defaults audit
  // entry exists, so it's safe to fire every empty-list mount —
  // returns { seeded: false } after the first run and the doctor
  // stays in control via the manual "Load suggested defaults" button.
  const autoSeedFirstUse = useMutation({
    mutationFn: () =>
      trpcClient.homeopathicMedicine.seedDefaultsIfFirstUse.mutate(),
    onSuccess: (result) => {
      if (result.seeded) {
        queryClient.invalidateQueries({ queryKey: [["homeopathicMedicine"]] });
      }
    },
  });
  const autoSeedAttempted = useRef(false);
  useEffect(() => {
    if (
      !listQuery.isLoading &&
      !listQuery.isError &&
      items.length === 0 &&
      !autoSeedAttempted.current
    ) {
      autoSeedAttempted.current = true;
      autoSeedFirstUse.mutate();
    }
  }, [listQuery.isLoading, listQuery.isError, items.length, autoSeedFirstUse]);

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(medicine: HomeopathicMedicine) {
    setEditing(medicine);
    setDialogOpen(true);
  }

  function handleDelete(medicine: HomeopathicMedicine) {
    if (
      window.confirm(
        `Remove "${medicine.name} ${medicine.potency}" from your list?`,
      )
    ) {
      deleteMutation.mutate(medicine.id);
    }
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between md:mb-8">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Medicines</h1>
          <p className="text-muted-foreground md:text-base">
            Your saved list of medicines — homeopathic, ayurvedic, unani, or
            allopathic. Used by the &ldquo;M&rdquo; picker in Clinical Notes.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <Button onClick={openAdd} className="md:h-12 md:px-6 md:text-base">
            <Plus className="h-4 w-4 md:h-5 md:w-5" />
            Add Medicine
          </Button>
        </div>
      </div>

      {seedFeedback && (
        <div className="mb-4 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
          {seedFeedback}
        </div>
      )}

      {listQuery.isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!listQuery.isLoading && items.length === 0 && (
        <div className="rounded-xl border bg-card">
          <div className="flex flex-col items-center justify-center px-4 py-16 text-muted-foreground">
            <Pill className="mb-3 h-12 w-12" />
            <p className="text-base font-medium">No medicines yet</p>
            <p className="mt-1 max-w-md text-center text-sm">
              Add the medicines you prescribe most often — homeopathic,
              ayurvedic, unani, or allopathic — to insert them into clinical
              notes in one tap. Or load a suggested starter list of 12 common
              homeopathic remedies you can edit later.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
              >
                {seedMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading
                  </>
                ) : (
                  <>Load suggested defaults</>
                )}
              </Button>
              <Button type="button" onClick={openAdd}>
                <Plus className="h-4 w-4" />
                Add Medicine
              </Button>
            </div>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="rounded-xl border bg-card">
          <ul className="divide-y">
            {items.map((medicine) => (
              <li
                key={medicine.id}
                className="flex items-start gap-3 px-4 py-3 sm:px-6 sm:py-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium md:text-base">
                    {medicine.name}
                    {medicine.potency && (
                      <>
                        {" "}
                        <span className="text-muted-foreground">
                          {medicine.potency}
                        </span>
                      </>
                    )}
                  </p>
                  {medicine.notes && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {medicine.notes}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => openEdit(medicine)}
                  className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Edit ${medicine.name}`}
                >
                  <Pencil className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(medicine)}
                  className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                  aria-label={`Delete ${medicine.name}`}
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Manoj msg 1562: keep "Load suggested defaults" out of the
          header so it doesn't crowd the Add Medicine CTA. Tuck it at
          the bottom of the page where a doctor who wants the starter
          list can still find it after scrolling through their own
          additions. */}
      {items.length > 0 && (
        <div className="mt-6 flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="md:h-10 md:text-sm"
          >
            {seedMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading
              </>
            ) : (
              "Load suggested defaults"
            )}
          </Button>
        </div>
      )}

      <MedicineDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
      />
    </div>
  );
}

function MedicineDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: HomeopathicMedicine | null;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [potency, setPotency] = useState("");
  const [notes, setNotes] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setPotency(editing?.potency ?? "");
    setNotes(editing?.notes ?? "");
    setServerError(null);
  }, [open, editing]);

  const createMutation = useMutation({
    mutationFn: () =>
      trpcClient.homeopathicMedicine.create.mutate({
        name: name.trim(),
        potency: potency.trim() || null,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["homeopathicMedicine"]] });
      onOpenChange(false);
    },
    onError: (err) => setServerError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      trpcClient.homeopathicMedicine.update.mutate({
        id: editing!.id,
        name: name.trim(),
        potency: potency.trim() || null,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["homeopathicMedicine"]] });
      onOpenChange(false);
    },
    onError: (err) => setServerError(err.message),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const canSubmit = name.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!canSubmit) return;
    if (editing) updateMutation.mutate();
    else createMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit medicine" : "Add medicine"}
          </DialogTitle>
          <DialogDescription>
            Saved medicines appear in the &ldquo;M&rdquo; picker inside Clinical
            Notes — works for homeopathic, ayurvedic, unani, and allopathic.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {serverError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="medicine-name">Name *</Label>
            <Input
              id="medicine-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Belladonna"
              autoFocus
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="medicine-potency">Strength / Potency</Label>
            <Input
              id="medicine-potency"
              value={potency}
              onChange={(e) => setPotency(e.target.value)}
              placeholder="e.g. 30C, 200, 1M, 500mg, 10ml"
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">
              Optional — leave blank for medicines without a potency or
              strength.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="medicine-notes">Ingredients / Dosage</Label>
            <Textarea
              id="medicine-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. paracetamol · 500 mg TDS"
              rows={2}
              maxLength={500}
            />
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!canSubmit || isPending}>
              {isPending
                ? "Saving..."
                : editing
                  ? "Save changes"
                  : "Add medicine"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

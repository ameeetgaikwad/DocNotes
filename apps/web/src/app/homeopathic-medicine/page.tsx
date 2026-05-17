"use client";

import { useEffect, useState } from "react";
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

  const seedMutation = useMutation({
    mutationFn: () => trpcClient.homeopathicMedicine.seedDefaults.mutate(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [["homeopathicMedicine"]] }),
  });

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
          <h1 className="text-2xl font-semibold md:text-3xl">
            Homeopathic Medicines
          </h1>
          <p className="text-muted-foreground md:text-base">
            Your saved list of medicines and potencies — used by the
            &ldquo;H&rdquo; picker in Clinical Notes.
          </p>
        </div>
        <Button
          onClick={openAdd}
          className="self-start md:h-12 md:px-6 md:text-base"
        >
          <Plus className="h-4 w-4 md:h-5 md:w-5" />
          Add Medicine
        </Button>
      </div>

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
              Add the medicines you prescribe most often to insert them into
              clinical notes in one tap — or load a suggested starter list of 12
              common remedies you can edit later.
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
                    {medicine.name}{" "}
                    <span className="text-muted-foreground">
                      {medicine.potency}
                    </span>
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
        potency: potency.trim(),
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
        potency: potency.trim(),
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["homeopathicMedicine"]] });
      onOpenChange(false);
    },
    onError: (err) => setServerError(err.message),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const canSubmit = name.trim().length > 0 && potency.trim().length > 0;

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
            Saved medicines appear in the &ldquo;H&rdquo; picker inside Clinical
            Notes.
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
            <Label htmlFor="medicine-potency">Potency *</Label>
            <Input
              id="medicine-potency"
              value={potency}
              onChange={(e) => setPotency(e.target.value)}
              placeholder="e.g. 30C, 200, 1M"
              maxLength={50}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="medicine-notes">Notes</Label>
            <Textarea
              id="medicine-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional — typical indications, dosage, etc."
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

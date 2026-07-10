"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { trpc, trpcClient } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Chemist {
  id: string;
  name: string;
  whatsappNumber: string;
  notes: string | null;
}

// Chemists / pharmacies the doctor sends prescriptions to (Manoj
// msg 2267). Mirrors the medicine-dealers section — same shape,
// different domain — but uses WhatsApp numbers as the primary
// contact channel since one-tap Send-to-Chemist opens WhatsApp.
export function ChemistsSection() {
  const queryClient = useQueryClient();
  const chemistsQuery = useQuery(trpc.chemist.list.queryOptions());

  const [editing, setEditing] = useState<Chemist | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const chemists = (chemistsQuery.data ?? []) as Chemist[];

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Chemists</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add chemist
        </Button>
      </div>

      {chemistsQuery.isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : chemists.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
          No chemists saved yet. Add one so you can send prescriptions to them
          in one tap from the Rx page.
        </p>
      ) : (
        <ul className="divide-y">
          {chemists.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium md:text-base">
                  {c.name}
                </p>
                <p className="text-xs text-muted-foreground md:text-sm">
                  {c.whatsappNumber}
                  {c.notes && <> · {c.notes}</>}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(c);
                    setFormOpen(true);
                  }}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Edit ${c.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <DeleteChemistButton
                  chemistId={c.id}
                  onDeleted={() =>
                    queryClient.invalidateQueries({
                      queryKey: [["chemist"]],
                    })
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {formOpen && (
        <ChemistForm
          initial={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            queryClient.invalidateQueries({ queryKey: [["chemist"]] });
          }}
        />
      )}
    </div>
  );
}

function DeleteChemistButton({
  chemistId,
  onDeleted,
}: {
  chemistId: string;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const mutation = useMutation({
    mutationFn: () => trpcClient.chemist.delete.mutate({ id: chemistId }),
    onSuccess: () => {
      setConfirming(false);
      onDeleted();
    },
  });
  return (
    <button
      type="button"
      onClick={() => {
        if (!confirming) {
          setConfirming(true);
          setTimeout(() => setConfirming(false), 3000);
          return;
        }
        mutation.mutate();
      }}
      disabled={mutation.isPending}
      className={
        confirming
          ? "rounded-md p-1 text-destructive hover:bg-destructive/10"
          : "rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
      }
      aria-label="Delete chemist"
    >
      {mutation.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </button>
  );
}

function ChemistForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Chemist | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [whatsappNumber, setWhatsappNumber] = useState(
    initial?.whatsappNumber ?? "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      return trpcClient.chemist.upsert.mutate({
        id: initial?.id,
        name,
        whatsappNumber,
        notes: notes.trim() || null,
      });
    },
    onSuccess: onSaved,
    onError: (e) => setError(e.message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        save.mutate();
      }}
      className="mt-4 space-y-3 rounded-md border bg-muted/30 p-4"
    >
      <p className="text-sm font-medium">
        {initial ? "Edit chemist" : "Add chemist"}
      </p>
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="chemist-name" className="text-xs">
            Name *
          </Label>
          <Input
            id="chemist-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sai Medical Stores"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="chemist-wa" className="text-xs">
            WhatsApp Number *
          </Label>
          <Input
            id="chemist-wa"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            placeholder="9850234103"
            inputMode="tel"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="chemist-notes" className="text-xs">
          Notes (optional)
        </Label>
        <Input
          id="chemist-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. 24 hr / preferred for pediatric"
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={save.isPending}>
          {save.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </form>
  );
}

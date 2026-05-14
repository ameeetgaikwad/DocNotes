"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { trpc, trpcClient } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Dealer {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
}

export function MedicineDealersSection() {
  const queryClient = useQueryClient();
  const dealersQuery = useQuery(trpc.medicineDealer.list.queryOptions());

  const [editing, setEditing] = useState<Dealer | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const dealers = (dealersQuery.data ?? []) as Dealer[];

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Medicine Dealers</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add dealer
        </Button>
      </div>

      {dealersQuery.isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : dealers.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
          No dealers saved yet. Add one to send purchase lists over WhatsApp.
        </p>
      ) : (
        <ul className="divide-y">
          {dealers.map((dealer) => (
            <li
              key={dealer.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium md:text-base">
                  {dealer.name}
                </p>
                <p className="text-xs text-muted-foreground md:text-sm">
                  {dealer.phone}
                  {dealer.notes && <> · {dealer.notes}</>}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(dealer);
                    setFormOpen(true);
                  }}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Edit ${dealer.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <DeleteDealerButton
                  dealerId={dealer.id}
                  onDeleted={() =>
                    queryClient.invalidateQueries({
                      queryKey: [["medicineDealer"]],
                    })
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {formOpen && (
        <DealerForm
          initial={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            queryClient.invalidateQueries({ queryKey: [["medicineDealer"]] });
          }}
        />
      )}
    </div>
  );
}

function DeleteDealerButton({
  dealerId,
  onDeleted,
}: {
  dealerId: string;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const mutation = useMutation({
    mutationFn: () => trpcClient.medicineDealer.delete.mutate({ id: dealerId }),
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
      aria-label="Delete dealer"
    >
      {mutation.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </button>
  );
}

function DealerForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Dealer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      return trpcClient.medicineDealer.upsert.mutate({
        id: initial?.id,
        name,
        phone,
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
        {initial ? "Edit dealer" : "Add dealer"}
      </p>
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="dealer-name" className="text-xs">
            Name *
          </Label>
          <Input
            id="dealer-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sharma Medical Store"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dealer-phone" className="text-xs">
            WhatsApp Number *
          </Label>
          <Input
            id="dealer-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="dealer-notes" className="text-xs">
          Notes (optional)
        </Label>
        <Input
          id="dealer-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Main supplier, opens 9-9"
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

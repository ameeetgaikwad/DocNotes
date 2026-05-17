"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Plus,
  Trash2,
  ShoppingCart,
  MessageCircle,
} from "lucide-react";
import { trpc, trpcClient } from "@/lib/trpc";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogClose as DialogClose,
} from "@/components/ui/responsive-dialog";

interface Item {
  id: string;
  text: string;
  isDone: boolean;
  createdAt: Date;
}

interface Dealer {
  id: string;
  name: string;
  phone: string;
}

function normalizePhoneForWa(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

export default function PurchaseListPage() {
  const queryClient = useQueryClient();
  const listOptions = trpc.purchaseItem.list.queryOptions();
  const itemsQuery = useQuery(listOptions);
  const dealersQuery = useQuery(trpc.medicineDealer.list.queryOptions());

  const [draftText, setDraftText] = useState("");
  const [sendOpen, setSendOpen] = useState(false);

  const addItem = useMutation({
    mutationFn: () =>
      trpcClient.purchaseItem.create.mutate({
        text: draftText,
        category: "medicine",
      }),
    onSuccess: () => {
      setDraftText("");
      queryClient.invalidateQueries({ queryKey: [["purchaseItem"]] });
    },
  });

  // Tick/untick was waiting on the server roundtrip + a full list
  // refetch before flipping in the UI (~600ms felt-time). Optimistic
  // update flips the checkbox instantly; we reconcile if the server
  // disagrees.
  const updateItem = useMutation({
    mutationFn: (input: { id: string; text?: string; isDone?: boolean }) =>
      trpcClient.purchaseItem.update.mutate(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: listOptions.queryKey });
      const prev = queryClient.getQueryData(listOptions.queryKey);
      queryClient.setQueryData(listOptions.queryKey, (old) =>
        (old ?? []).map((it) =>
          it.id === input.id ? { ...it, ...input } : it,
        ),
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(listOptions.queryKey, context.prev);
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: [["purchaseItem"]] }),
  });

  const deleteItem = useMutation({
    mutationFn: (id: string) => trpcClient.purchaseItem.delete.mutate({ id }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: listOptions.queryKey });
      const prev = queryClient.getQueryData(listOptions.queryKey);
      queryClient.setQueryData(listOptions.queryKey, (old) =>
        (old ?? []).filter((it) => it.id !== id),
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(listOptions.queryKey, context.prev);
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: [["purchaseItem"]] }),
  });

  const items = (itemsQuery.data ?? []) as Item[];
  const dealers = (dealersQuery.data ?? []) as Dealer[];

  const pending = items.filter((i) => !i.isDone);
  const done = items.filter((i) => i.isDone);

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between md:mb-8">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">
            Purchase List of Medicine
          </h1>
          <p className="text-muted-foreground md:text-base">
            Medicines to buy — send the list to a dealer over WhatsApp.
          </p>
        </div>
        <Button
          onClick={() => setSendOpen(true)}
          disabled={pending.length === 0}
          className="self-start md:h-12 md:px-6 md:text-base"
        >
          <MessageCircle className="h-4 w-4 md:h-5 md:w-5" />
          Send to dealer
        </Button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draftText.trim()) addItem.mutate();
        }}
        className="mb-6 flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4"
      >
        <Input
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          placeholder="e.g. Paracetamol 500mg × 2 strips"
          className="flex-1"
        />
        <Button type="submit" disabled={!draftText.trim() || addItem.isPending}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </form>

      {itemsQuery.isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!itemsQuery.isLoading && items.length === 0 && (
        <div className="rounded-xl border bg-card">
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ShoppingCart className="mb-3 h-12 w-12" />
            <p className="text-base font-medium">Your list is empty</p>
            <p className="text-sm">
              Add medicines, injections, or reminders above.
            </p>
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="mb-6 rounded-xl border bg-card">
          <div className="border-b px-4 py-3 sm:px-6 sm:py-4">
            <h2 className="text-base font-semibold md:text-lg">
              To buy ({pending.length})
            </h2>
          </div>
          <ul className="divide-y">
            {pending.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onToggle={() =>
                  updateItem.mutate({ id: item.id, isDone: !item.isDone })
                }
                onDelete={() => deleteItem.mutate(item.id)}
              />
            ))}
          </ul>
        </div>
      )}

      {done.length > 0 && (
        <div className="rounded-xl border bg-card">
          <div className="border-b px-4 py-3 sm:px-6 sm:py-4">
            <h2 className="text-base font-semibold text-muted-foreground md:text-lg">
              Done ({done.length})
            </h2>
          </div>
          <ul className="divide-y">
            {done.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onToggle={() =>
                  updateItem.mutate({ id: item.id, isDone: !item.isDone })
                }
                onDelete={() => deleteItem.mutate(item.id)}
              />
            ))}
          </ul>
        </div>
      )}

      <SendDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        dealers={dealers}
        items={pending}
      />
    </div>
  );
}

function ItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: Item;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3 sm:px-6 sm:py-4">
      <input
        type="checkbox"
        checked={item.isDone}
        onChange={onToggle}
        className="mt-1 h-4 w-4 cursor-pointer accent-primary"
        aria-label={`Mark "${item.text}" as ${item.isDone ? "not done" : "done"}`}
      />
      <div className="min-w-0 flex-1">
        <p
          className={
            item.isDone
              ? "text-sm text-muted-foreground line-through md:text-base"
              : "text-sm md:text-base"
          }
        >
          {item.text}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatDate(item.createdAt)}
        </p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
        aria-label="Delete item"
      >
        <Trash2 className="h-5 w-5" />
      </button>
    </li>
  );
}

function SendDialog({
  open,
  onOpenChange,
  dealers,
  items,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dealers: Dealer[];
  items: Item[];
}) {
  const [selectedId, setSelectedId] = useState<string>("");
  const selected = dealers.find((d) => d.id === selectedId) ?? null;

  const messageText = useMemo(() => {
    const lines: string[] = ["Hello, please arrange the following medicines:"];
    lines.push("");
    for (const item of items) lines.push(`- ${item.text}`);
    lines.push("", "Thank you.");
    return lines.join("\n");
  }, [items]);

  function send() {
    if (!selected) return;
    const phone = normalizePhoneForWa(selected.phone);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(messageText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send purchase list</DialogTitle>
          <DialogDescription>
            Pick a dealer and we&apos;ll open WhatsApp with the list pre-filled.
          </DialogDescription>
        </DialogHeader>

        {dealers.length === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/40 p-4 text-sm">
            No dealers saved yet. Add one or more in{" "}
            <Link
              href="/settings"
              className="text-primary hover:underline"
              onClick={() => onOpenChange(false)}
            >
              Settings → Medicine Dealers
            </Link>
            .
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <label htmlFor="dealer-select" className="text-sm font-medium">
                Dealer
              </label>
              <Select
                id="dealer-select"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                <option value="">— Pick a dealer —</option>
                {dealers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.phone})
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Preview
              </p>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs">
                {messageText}
              </pre>
            </div>
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
            onClick={send}
            disabled={!selected || items.length === 0}
          >
            <MessageCircle className="h-4 w-4" />
            Open WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

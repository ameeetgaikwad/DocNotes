"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { trpcClient } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

interface DeleteEntryButtonProps {
  entryId: string;
  visitDate: string;
  children: ReactNode;
}

export function DeleteEntryButton({
  entryId,
  visitDate,
  children,
}: DeleteEntryButtonProps) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => trpcClient.dailyRegister.delete.mutate({ id: entryId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["dailyRegister"]] });
      setConfirming(false);
    },
  });

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="destructive"
          size="sm"
          disabled={deleteMutation.isPending}
          onClick={() => deleteMutation.mutate()}
        >
          Delete
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  // Suppress visitDate-unused warning — keep the prop so callers
  // signal which date's cache to refresh.
  void visitDate;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:text-destructive"
      onClick={() => setConfirming(true)}
    >
      {children}
    </Button>
  );
}

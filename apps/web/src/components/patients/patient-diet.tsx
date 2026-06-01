"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, UtensilsCrossed } from "lucide-react";
import { trpcClient } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface PatientDietProps {
  patientId: string;
  initialDietNotes: string | null;
}

export function PatientDiet({ patientId, initialDietNotes }: PatientDietProps) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(initialDietNotes ?? "");
  const [savedValue, setSavedValue] = useState(initialDietNotes ?? "");

  useEffect(() => {
    setValue(initialDietNotes ?? "");
    setSavedValue(initialDietNotes ?? "");
  }, [initialDietNotes]);

  const saveMutation = useMutation({
    mutationFn: async (next: string) => {
      const trimmed = next.trim();
      return trpcClient.patient.update.mutate({
        id: patientId,
        data: { dietNotes: trimmed || null },
      });
    },
    onSuccess: (_, next) => {
      const trimmed = next.trim();
      setSavedValue(trimmed);
      setValue(trimmed);
      queryClient.invalidateQueries({ queryKey: [["patient"]] });
    },
  });

  const dirty = value !== savedValue;

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <UtensilsCrossed className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold md:text-xl">Diet</h2>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="diet-notes" className="md:text-base">
          Diet notes
        </Label>
        <Textarea
          id="diet-notes"
          rows={10}
          maxLength={5000}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="md:min-h-[12rem] md:text-base"
        />
        <p className="text-xs text-muted-foreground md:text-sm">
          Free text. Up to 5,000 characters. Saved to the patient record.
        </p>
      </div>

      {saveMutation.error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {saveMutation.error.message}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          onClick={() => saveMutation.mutate(value)}
          disabled={!dirty || saveMutation.isPending}
          className="md:h-11 md:px-5 md:text-base"
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> Save Diet
            </>
          )}
        </Button>
        {dirty && !saveMutation.isPending && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setValue(savedValue)}
            className="md:h-11 md:px-5 md:text-base"
          >
            Discard changes
          </Button>
        )}
      </div>
    </div>
  );
}

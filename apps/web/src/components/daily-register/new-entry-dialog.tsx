"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { trpc, trpcClient } from "@/lib/trpc";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

interface NewEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitDate: string;
}

export function NewDailyRegisterEntryDialog({
  open,
  onOpenChange,
  visitDate,
}: NewEntryDialogProps) {
  const queryClient = useQueryClient();
  const [patientSearch, setPatientSearch] = useState("");
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientLabel, setPatientLabel] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "digital">("cash");
  const [notes, setNotes] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  const debouncedSearch = useDebounce(patientSearch, 250);

  const patientsQuery = useQuery({
    ...trpc.patient.list.queryOptions({
      query: debouncedSearch || undefined,
      page: 1,
      limit: 10,
    }),
    enabled: open && debouncedSearch.length > 0,
  });

  useEffect(() => {
    if (!open) {
      setPatientSearch("");
      setPatientId(null);
      setPatientLabel("");
      setFeeAmount("");
      setPaymentMode("cash");
      setNotes("");
      setServerError(null);
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: () => {
      if (!patientId) throw new Error("Pick a patient first");
      return trpcClient.dailyRegister.create.mutate({
        patientId,
        visitDate,
        feeAmount: Number(feeAmount),
        paymentMode,
        notes: notes.trim() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["dailyRegister"]] });
      onOpenChange(false);
    },
    onError: (e) => {
      setServerError(e.message);
    },
  });

  const canSubmit =
    patientId !== null && feeAmount !== "" && Number(feeAmount) >= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Register Entry</DialogTitle>
          <DialogDescription>
            Record a patient visit with fees received on {visitDate}.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit && !createMutation.isPending) createMutation.mutate();
          }}
          className="space-y-4"
        >
          {serverError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="patient-search">Patient *</Label>
            {patientId ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <span className="font-medium">{patientLabel}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPatientId(null);
                    setPatientLabel("");
                    setPatientSearch("");
                  }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <>
                <Input
                  id="patient-search"
                  type="text"
                  placeholder="Search by name, phone, or email"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  autoFocus
                />
                {debouncedSearch && (
                  <div className="max-h-48 overflow-y-auto rounded-md border">
                    {patientsQuery.isLoading && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {patientsQuery.data &&
                      patientsQuery.data.items.length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No patients found
                        </div>
                      )}
                    {patientsQuery.data?.items.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPatientId(p.id);
                          setPatientLabel(`${p.firstName} ${p.lastName}`);
                        }}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <span>
                          {p.firstName} {p.lastName}
                        </span>
                        {p.phone && (
                          <span className="text-xs text-muted-foreground">
                            {p.phone}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fee">Fee (₹) *</Label>
              <Input
                id="fee"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Mode *</Label>
              <div className="flex gap-1 rounded-md border p-1">
                {(["cash", "digital"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPaymentMode(mode)}
                    className={`flex-1 rounded-sm px-3 py-1.5 text-sm transition ${
                      paymentMode === mode
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {mode === "cash" ? "Cash" : "Digital"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              rows={2}
              maxLength={1000}
              placeholder="Any short notes about the visit"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={!canSubmit || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving
                </>
              ) : (
                "Save Entry"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

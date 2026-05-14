"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertCircle, Wallet, Save } from "lucide-react";
import { trpc, trpcClient } from "@/lib/trpc";
import { formatDate, todayLocalIsoDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

interface DueRow {
  id: string;
  visitDate: string;
  feeAmount: string;
  paidAmount: string;
  serviceType: string | null;
  feeReceivedAt: string | null;
  remaining: number;
}

export function PatientPendingDues({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  const duesQuery = useQuery(
    trpc.dailyRegister.pendingDuesByPatient.queryOptions({ patientId }),
  );

  if (duesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (duesQuery.error) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <AlertCircle className="mb-3 h-10 w-10 text-destructive/60" />
          <p className="text-base font-medium">Failed to load pending dues</p>
          <p className="text-sm">Check your connection and try again</p>
        </div>
      </div>
    );
  }

  const items = (duesQuery.data?.items ?? []) as DueRow[];
  const total = duesQuery.data?.total ?? 0;

  if (items.length === 0) {
    return (
      <div className="rounded-xl border bg-card">
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Wallet className="mb-3 h-12 w-12" />
          <p className="text-base font-medium">No pending dues</p>
          <p className="text-sm">
            Register entries marked &ldquo;Due&rdquo; will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Pending Dues</h2>
        <p className="text-sm text-muted-foreground">
          Edit a row&apos;s remaining amount when a partial payment is received.
        </p>
      </div>
      <div className="divide-y">
        {items.map((row) => (
          <DueRowItem
            key={row.id}
            row={row}
            onSaved={() =>
              queryClient.invalidateQueries({ queryKey: [["dailyRegister"]] })
            }
          />
        ))}
      </div>
      <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-3 sm:px-6 sm:py-4">
        <p className="text-sm font-medium text-muted-foreground">
          Total Pending Dues
        </p>
        <p className="text-lg font-semibold md:text-xl">{formatINR(total)}</p>
      </div>
    </div>
  );
}

function DueRowItem({ row, onSaved }: { row: DueRow; onSaved: () => void }) {
  const fee = Number(row.feeAmount);
  const paid = Number(row.paidAmount ?? 0);
  const [remainingInput, setRemainingInput] = useState(
    String(row.remaining ?? Math.max(fee - paid, 0)),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRemainingInput(String(row.remaining ?? Math.max(fee - paid, 0)));
  }, [row.remaining, fee, paid]);

  const recordPayment = useMutation({
    mutationFn: async () => {
      const remaining = Number(remainingInput);
      if (!Number.isFinite(remaining) || remaining < 0) {
        throw new Error("Enter a valid remaining amount");
      }
      if (remaining > fee) {
        throw new Error(`Remaining cannot exceed the original fee of ${fee}`);
      }
      const newPaid = fee - remaining;
      return trpcClient.dailyRegister.recordPayment.mutate({
        id: row.id,
        paidAmount: newPaid,
        feeReceivedAt: newPaid > 0 ? todayLocalIsoDate() : null,
      });
    },
    onSuccess: () => {
      setError(null);
      onSaved();
    },
    onError: (e) => setError(e.message),
  });

  const remaining = Number(remainingInput);
  const dirty =
    Number.isFinite(remaining) &&
    remaining !== Math.max(fee - paid, 0) &&
    remaining >= 0 &&
    remaining <= fee;

  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6 sm:py-4">
      <div className="flex-1">
        <p className="text-sm font-medium">{formatDate(row.visitDate)}</p>
        {row.serviceType && (
          <p className="text-xs text-muted-foreground">{row.serviceType}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          Original fee {formatINR(fee)}
          {paid > 0 && <> · received {formatINR(paid)} so far</>}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">₹</span>
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          max={fee}
          value={remainingInput}
          onChange={(e) => setRemainingInput(e.target.value)}
          className="w-28 text-right"
          aria-label="Remaining amount"
        />
        <Button
          type="button"
          size="sm"
          disabled={!dirty || recordPayment.isPending}
          onClick={() => recordPayment.mutate()}
        >
          {recordPayment.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save
        </Button>
      </div>
      {error && (
        <p className="text-xs text-destructive sm:basis-full">{error}</p>
      )}
    </div>
  );
}

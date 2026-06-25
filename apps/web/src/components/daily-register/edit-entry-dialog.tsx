"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Clock,
  Ban,
  Banknote,
  Smartphone,
  Save,
  Loader2,
  SplitSquareHorizontal,
} from "lucide-react";
import { SERVICE_TYPES } from "@docnotes/shared";
import { trpcClient } from "@/lib/trpc";
import { todayLocalIsoDate, formatPatientName } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { CalendarInput } from "@/components/ui/calendar-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
import { SplitPaymentBlock } from "./split-payment-block";

type PaymentStatus = "paid" | "due" | "nil" | "split";
type PaymentMode = "cash" | "digital";

export interface RegisterEntryForEdit {
  id: string;
  visitDate: string;
  serviceType: string | null;
  feeAmount: string | number | null;
  paymentMode: string | null;
  paymentStatus: string | null;
  cashAmount?: string | number | null;
  digitalAmount?: string | number | null;
  balanceAmount?: string | number | null;
  feeReceivedAt: string | null;
  diagnosis: string | null;
  notes: string | null;
  patient: {
    firstName: string;
    middleName?: string | null;
    lastName: string;
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: RegisterEntryForEdit | null;
}

export function EditDailyRegisterEntryDialog({
  open,
  onOpenChange,
  entry,
}: Props) {
  const queryClient = useQueryClient();
  const [serviceType, setServiceType] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("paid");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [splitCash, setSplitCash] = useState("");
  const [splitDigital, setSplitDigital] = useState("");
  const [receiptDate, setReceiptDate] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !entry) return;
    setServiceType(entry.serviceType ?? "");
    setFeeAmount(
      entry.feeAmount != null && Number(entry.feeAmount) > 0
        ? String(Number(entry.feeAmount))
        : "",
    );
    setPaymentStatus((entry.paymentStatus as PaymentStatus) || "paid");
    setPaymentMode((entry.paymentMode as PaymentMode) || "cash");
    setSplitCash(
      entry.cashAmount != null && Number(entry.cashAmount) > 0
        ? String(Number(entry.cashAmount))
        : "",
    );
    setSplitDigital(
      entry.digitalAmount != null && Number(entry.digitalAmount) > 0
        ? String(Number(entry.digitalAmount))
        : "",
    );
    setReceiptDate(entry.feeReceivedAt ?? "");
    setDiagnosis(entry.diagnosis ?? "");
    setNotes(entry.notes ?? "");
    setServerError(null);
  }, [open, entry]);

  // Mirror the create-dialog behaviour: switching to Paid or Split
  // auto-fills today if blank; switching to Due clears it.
  useEffect(() => {
    if (paymentStatus === "paid" || paymentStatus === "split") {
      setReceiptDate((current) => current || todayLocalIsoDate());
    } else if (paymentStatus === "due") {
      setReceiptDate("");
    }
  }, [paymentStatus]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!entry) throw new Error("Nothing to update");
      const fee =
        paymentStatus === "nil" || feeAmount === "" ? 0 : Number(feeAmount);
      const cashNum = Number(splitCash) || 0;
      const digitalNum = Number(splitDigital) || 0;
      const balanceNum = Math.max(0, fee - cashNum - digitalNum);
      const splitFields =
        paymentStatus === "split"
          ? {
              cashAmount: cashNum,
              digitalAmount: digitalNum,
              balanceAmount: balanceNum,
            }
          : {};
      return trpcClient.dailyRegister.update.mutate({
        id: entry.id,
        data: {
          serviceType: serviceType || null,
          feeAmount: fee,
          paymentMode,
          paymentStatus,
          ...splitFields,
          feeReceivedAt: receiptDate || null,
          diagnosis: diagnosis.trim() || null,
          notes: notes.trim() || null,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["dailyRegister"]] });
      onOpenChange(false);
    },
    onError: (e) => setServerError(e.message),
  });

  const feeOk =
    paymentStatus === "nil" || feeAmount === "" || Number(feeAmount) >= 0;
  const receiptDateOk =
    receiptDate === "" || /^\d{4}-\d{2}-\d{2}$/.test(receiptDate);
  const splitOk =
    paymentStatus !== "split" ||
    (Number(feeAmount) > 0 &&
      (Number(splitCash) || 0) + (Number(splitDigital) || 0) <=
        Number(feeAmount) + 0.005);
  const canSubmit =
    entry !== null && serviceType !== "" && feeOk && splitOk && receiptDateOk;

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md md:max-w-xl lg:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="md:text-2xl">Edit Register Entry</DialogTitle>
          <DialogDescription className="md:text-base">
            Update service, fees, payment, diagnosis, or remarks for this
            patient&apos;s visit. Patient and date are fixed.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit && !updateMutation.isPending) updateMutation.mutate();
          }}
          className="space-y-4 md:space-y-5"
        >
          {serverError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
            <span className="font-medium">
              {formatPatientName(entry.patient)}
            </span>
            <span className="ml-2 text-muted-foreground">
              · {entry.visitDate}
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-service-type" className="md:text-base">
              Service *
            </Label>
            <Select
              id="edit-service-type"
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className="md:h-12 md:text-base"
            >
              <option value="">— Select service —</option>
              {SERVICE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-fee" className="md:text-base">
              Fees Received (₹)
            </Label>
            <div className="flex flex-wrap items-stretch gap-2 md:gap-3">
              <Input
                id="edit-fee"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={paymentStatus === "nil" ? "" : feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
                disabled={paymentStatus === "nil"}
                className="min-w-[8rem] flex-1 md:h-12 md:text-base"
              />
              <div className="flex flex-wrap gap-1 rounded-md border p-1 md:gap-2 md:p-1.5">
                {(
                  [
                    { key: "paid", label: "Paid", Icon: Check },
                    { key: "due", label: "Due", Icon: Clock },
                    { key: "nil", label: "Nil", Icon: Ban },
                    {
                      key: "split",
                      label: "Split",
                      Icon: SplitSquareHorizontal,
                    },
                  ] as const
                ).map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPaymentStatus(key)}
                    className={`flex flex-col items-center rounded-sm px-3 py-1.5 text-xs transition md:min-w-[4rem] md:px-4 md:py-2 md:text-sm ${
                      paymentStatus === key
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <Icon className="h-4 w-4 md:h-5 md:w-5" />
                    <span className="mt-0.5">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {paymentStatus === "split" && (
            <SplitPaymentBlock
              feeAmount={feeAmount}
              cash={splitCash}
              digital={splitDigital}
              setCash={setSplitCash}
              setDigital={setSplitDigital}
              idPrefix="edit-split"
            />
          )}

          {paymentStatus !== "nil" && paymentStatus !== "split" && (
            <div className="space-y-2">
              <Label className="md:text-base">Payment Mode *</Label>
              <div className="grid grid-cols-2 gap-2 md:gap-3">
                {(
                  [
                    { key: "cash", label: "Cash", Icon: Banknote },
                    {
                      key: "digital",
                      label: "Digital / UPI",
                      Icon: Smartphone,
                    },
                  ] as const
                ).map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPaymentMode(key)}
                    className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition md:py-3 md:text-base ${
                      paymentMode === key
                        ? "border-primary bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <Icon className="h-4 w-4 md:h-5 md:w-5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {paymentStatus !== "nil" && (
            <div className="space-y-2">
              <Label htmlFor="edit-receipt-date" className="md:text-base">
                Date of Receipt of Fees
              </Label>
              <div className="flex items-center gap-2">
                <CalendarInput
                  id="edit-receipt-date"
                  value={receiptDate}
                  onChange={setReceiptDate}
                  max={todayLocalIsoDate()}
                  className="md:h-12 md:text-base"
                />
                {receiptDate && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setReceiptDate("")}
                    className="md:h-12 md:px-3"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-diagnosis" className="md:text-base">
              Diagnosis
            </Label>
            <Input
              id="edit-diagnosis"
              type="text"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="Optional"
              className="md:h-12 md:text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-notes" className="md:text-base">
              Remarks / Notes
            </Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              rows={3}
              className="md:min-h-[6rem] md:text-base"
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
              disabled={!canSubmit || updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" /> Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

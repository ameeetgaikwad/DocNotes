"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Loader2,
  UserPlus,
  Check,
  Clock,
  Ban,
  Banknote,
  Smartphone,
  Save,
} from "lucide-react";
import { SERVICE_TYPES } from "@docnotes/shared";
import { trpc, trpcClient } from "@/lib/trpc";
import { todayLocalIsoDate } from "@/lib/format";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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

type PaymentStatus = "paid" | "due" | "nil";
type PaymentMode = "cash" | "digital";

interface SelectedPatient {
  id: string;
  label: string;
  dobDay: number | null;
  dobMonth: number | null;
  dobYear: number | null;
}

function sanitizeDigits(value: string, maxLen: number): string {
  return value.replace(/\D/g, "").slice(0, maxLen);
}

function parseIsoDate(
  iso: string | null | undefined,
): { day: number; month: number; year: number } | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function NewDailyRegisterEntryDialog({
  open,
  onOpenChange,
  visitDate,
}: NewEntryDialogProps) {
  const queryClient = useQueryClient();
  const [patientSearch, setPatientSearch] = useState("");
  const [patient, setPatient] = useState<SelectedPatient | null>(null);
  const [dobDay, setDobDay] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobYear, setDobYear] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("paid");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [receiptDate, setReceiptDate] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
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
      setPatient(null);
      setDobDay("");
      setDobMonth("");
      setDobYear("");
      setServiceType("");
      setFeeAmount("");
      setPaymentStatus("paid");
      setPaymentMode("cash");
      setReceiptDate("");
      setDiagnosis("");
      setNotes("");
      setServerError(null);
    }
  }, [open]);

  function selectPatient(p: SelectedPatient) {
    setPatient(p);
    setDobDay(p.dobDay != null ? String(p.dobDay) : "");
    setDobMonth(p.dobMonth != null ? String(p.dobMonth) : "");
    setDobYear(p.dobYear != null ? String(p.dobYear) : "");
  }

  function clearPatient() {
    setPatient(null);
    setPatientSearch("");
    setDobDay("");
    setDobMonth("");
    setDobYear("");
  }

  const parsedDob = useMemo(() => {
    const d = dobDay === "" ? null : Number(dobDay);
    const m = dobMonth === "" ? null : Number(dobMonth);
    const y = dobYear === "" ? null : Number(dobYear);
    return { d, m, y };
  }, [dobDay, dobMonth, dobYear]);

  const dobError = useMemo(() => {
    const { d, m, y } = parsedDob;
    if (d !== null && (d < 1 || d > 31)) return "Day must be 1-31";
    if (m !== null && (m < 1 || m > 12)) return "Month must be 1-12";
    const thisYear = new Date().getFullYear();
    if (y !== null && (y < 1900 || y > thisYear))
      return `Year must be 1900-${thisYear}`;
    if (d !== null && m !== null && y !== null) {
      const probe = new Date(Date.UTC(y, m - 1, d));
      if (
        probe.getUTCFullYear() !== y ||
        probe.getUTCMonth() !== m - 1 ||
        probe.getUTCDate() !== d
      ) {
        return "That date doesn't exist in the calendar";
      }
    }
    return null;
  }, [parsedDob]);

  const dobChanged = useMemo(() => {
    if (!patient) return false;
    return (
      parsedDob.d !== patient.dobDay ||
      parsedDob.m !== patient.dobMonth ||
      parsedDob.y !== patient.dobYear
    );
  }, [patient, parsedDob]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!patient) throw new Error("Pick a patient first");
      // Save DOB first so a server-side DOB rejection can't leave a
      // committed register entry behind.
      if (dobChanged) {
        const updated = await trpcClient.patient.updateDob.mutate({
          id: patient.id,
          dobDay: parsedDob.d,
          dobMonth: parsedDob.m,
          dobYear: parsedDob.y,
        });
        if (updated) {
          setPatient({
            ...patient,
            dobDay: updated.dobDay ?? null,
            dobMonth: updated.dobMonth ?? null,
            dobYear: updated.dobYear ?? null,
          });
        }
      }
      const fee = paymentStatus === "nil" ? 0 : Number(feeAmount);
      const entry = await trpcClient.dailyRegister.create.mutate({
        patientId: patient.id,
        visitDate,
        serviceType: serviceType || null,
        feeAmount: fee,
        paymentMode,
        paymentStatus,
        feeReceivedAt: receiptDate || null,
        diagnosis: diagnosis.trim() || null,
        notes: notes.trim() || null,
      });
      return entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["dailyRegister"]] });
      queryClient.invalidateQueries({ queryKey: [["patient"]] });
      onOpenChange(false);
    },
    onError: (e) => {
      setServerError(e.message);
    },
  });

  const quickCreatePatient = useMutation({
    mutationFn: async (typed: string) => {
      const parts = typed.trim().split(/\s+/);
      const firstName = parts[0] ?? "";
      const lastName = parts.slice(1).join(" ");
      const created = await trpcClient.patient.quickCreate.mutate({
        firstName,
        lastName,
      });
      return created;
    },
    onSuccess: (created) => {
      if (!created) return;
      queryClient.invalidateQueries({ queryKey: [["patient"]] });
      selectPatient({
        id: created.id,
        label: `${created.firstName}${created.lastName ? " " + created.lastName : ""}`,
        dobDay: created.dobDay ?? null,
        dobMonth: created.dobMonth ?? null,
        dobYear: created.dobYear ?? null,
      });
    },
    onError: (e) => {
      setServerError(e.message);
    },
  });

  const typedName = debouncedSearch.trim();
  const existingNames =
    patientsQuery.data?.items.map((p) =>
      `${p.firstName} ${p.lastName}`.toLowerCase().trim(),
    ) ?? [];
  const exactMatchExists = existingNames.includes(typedName.toLowerCase());
  const canQuickCreate = typedName.length > 0 && !exactMatchExists;

  const feeOk =
    paymentStatus === "nil" || (feeAmount !== "" && Number(feeAmount) >= 0);
  const receiptDateOk =
    receiptDate === "" || /^\d{4}-\d{2}-\d{2}$/.test(receiptDate);
  const canSubmit =
    patient !== null &&
    serviceType !== "" &&
    feeOk &&
    receiptDateOk &&
    dobError === null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md md:max-w-xl lg:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="md:text-2xl">Add Register Entry</DialogTitle>
          <DialogDescription className="md:text-base">
            Record a patient visit, service, and fees received.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit && !createMutation.isPending) createMutation.mutate();
          }}
          className="space-y-4 md:space-y-5"
        >
          {serverError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="patient-search" className="md:text-base">
              Patient *
            </Label>
            {patient ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm md:px-4 md:py-3 md:text-base">
                <span className="font-medium">{patient.label}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearPatient}
                  className="md:h-10 md:px-4"
                >
                  Change
                </Button>
              </div>
            ) : (
              <>
                <Input
                  id="patient-search"
                  type="text"
                  placeholder="Search by name, phone, or diagnosis"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  autoFocus
                  className="md:h-12 md:text-base"
                />
                {debouncedSearch && (
                  <div className="max-h-48 overflow-y-auto rounded-md border">
                    {patientsQuery.isLoading && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {patientsQuery.data?.items.map((p) => {
                      const derived = parseIsoDate(p.dateOfBirth);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() =>
                            selectPatient({
                              id: p.id,
                              label: `${p.firstName} ${p.lastName}`,
                              dobDay: p.dobDay ?? derived?.day ?? null,
                              dobMonth: p.dobMonth ?? derived?.month ?? null,
                              dobYear: p.dobYear ?? derived?.year ?? null,
                            })
                          }
                          className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm hover:bg-accent md:px-4 md:py-3 md:text-base"
                        >
                          <span>
                            {p.firstName} {p.lastName}
                          </span>
                          {p.phone && (
                            <span className="text-xs text-muted-foreground md:text-sm">
                              {p.phone}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {canQuickCreate && (
                      <button
                        type="button"
                        onClick={() => quickCreatePatient.mutate(typedName)}
                        disabled={quickCreatePatient.isPending}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary hover:bg-accent disabled:opacity-50 md:px-4 md:py-3 md:text-base"
                      >
                        {quickCreatePatient.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserPlus className="h-4 w-4" />
                        )}
                        <span>
                          Add new patient: &ldquo;
                          <span className="font-medium">{typedName}</span>
                          &rdquo;
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label className="md:text-base">Date of Birth (optional)</Label>
            <div className="flex items-center gap-2 md:gap-3">
              <Input
                aria-label="Day"
                inputMode="numeric"
                placeholder="DD"
                maxLength={2}
                className="w-16 text-center md:h-12 md:w-20 md:text-base"
                value={dobDay}
                onChange={(e) => setDobDay(sanitizeDigits(e.target.value, 2))}
              />
              <span className="text-muted-foreground md:text-lg">/</span>
              <Input
                aria-label="Month"
                inputMode="numeric"
                placeholder="MM"
                maxLength={2}
                className="w-16 text-center md:h-12 md:w-20 md:text-base"
                value={dobMonth}
                onChange={(e) => setDobMonth(sanitizeDigits(e.target.value, 2))}
              />
              <span className="text-muted-foreground md:text-lg">/</span>
              <Input
                aria-label="Year"
                inputMode="numeric"
                placeholder="YYYY"
                maxLength={4}
                className="w-24 text-center md:h-12 md:w-28 md:text-base"
                value={dobYear}
                onChange={(e) => setDobYear(sanitizeDigits(e.target.value, 4))}
              />
            </div>
            <p className="text-xs text-muted-foreground md:text-sm">
              Year alone is fine — leave day or month blank if unknown.
            </p>
            {dobError && (
              <p className="text-xs text-destructive md:text-sm">{dobError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-type" className="md:text-base">
              Nature of Professional Services Rendered *
            </Label>
            <Select
              id="service-type"
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
            <Label htmlFor="fee" className="md:text-base">
              Fees Received (₹) *
            </Label>
            <div className="flex flex-wrap items-stretch gap-2 md:gap-3">
              <Input
                id="fee"
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
              <div className="flex gap-1 rounded-md border p-1 md:gap-2 md:p-1.5">
                {(
                  [
                    { key: "paid", label: "Paid", Icon: Check },
                    { key: "due", label: "Due", Icon: Clock },
                    { key: "nil", label: "Nil", Icon: Ban },
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

          {paymentStatus !== "nil" && (
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
              <Label htmlFor="receipt-date" className="md:text-base">
                Date of Receipt of Fees (optional)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="receipt-date"
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
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
              <p className="text-xs text-muted-foreground md:text-sm">
                Leave blank if fees haven&apos;t been received yet (e.g. when
                marked Due).
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="diagnosis" className="md:text-base">
              Diagnosis (optional)
            </Label>
            <Input
              id="diagnosis"
              type="text"
              maxLength={500}
              placeholder="e.g. Type 2 Diabetes, Hypertension"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              className="md:h-12 md:text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="md:text-base">
              Remarks (optional)
            </Label>
            <Textarea
              id="notes"
              rows={2}
              maxLength={1000}
              placeholder="Referral, notes, medicine given."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="md:min-h-[5rem] md:text-base"
            />
          </div>

          <DialogFooter className="gap-2 md:gap-3">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                className="md:h-12 md:px-6 md:text-base"
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={!canSubmit || createMutation.isPending}
              className="md:h-12 md:px-6 md:text-base"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin md:h-5 md:w-5" />{" "}
                  Saving
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 md:h-5 md:w-5" /> Save to Register
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

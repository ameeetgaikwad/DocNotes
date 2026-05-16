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
import { SERVICE_TYPES, type Gender } from "@docnotes/shared";
import { trpc, trpcClient } from "@/lib/trpc";
import {
  todayLocalIsoDate,
  formatPatientName,
  formatPatientAgeDob,
} from "@/lib/format";
import { useDebounce } from "@/hooks/use-debounce";
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
  const [entryDate, setEntryDate] = useState(visitDate);
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

  // Inline "Add new patient" mini-form state — populated when the doctor
  // taps the affordance after no exact-name match is found.
  const [addingNewPatient, setAddingNewPatient] = useState(false);
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientGender, setNewPatientGender] = useState<Gender | "">("");
  const [newPatientPhone, setNewPatientPhone] = useState("");
  const [newPatientDobDay, setNewPatientDobDay] = useState("");
  const [newPatientDobMonth, setNewPatientDobMonth] = useState("");
  const [newPatientDobYear, setNewPatientDobYear] = useState("");

  const debouncedSearch = useDebounce(patientSearch, 250);
  const trimmedSearch = debouncedSearch.trim();

  const patientsQuery = useQuery({
    ...trpc.patient.list.queryOptions({
      query: trimmedSearch || undefined,
      page: 1,
      limit: 10,
    }),
    enabled: open && trimmedSearch.length > 0,
  });

  useEffect(() => {
    if (open) {
      setEntryDate(visitDate);
    } else {
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
      setAddingNewPatient(false);
      setNewPatientName("");
      setNewPatientGender("");
      setNewPatientPhone("");
      setNewPatientDobDay("");
      setNewPatientDobMonth("");
      setNewPatientDobYear("");
    }
  }, [open, visitDate]);

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
        visitDate: entryDate,
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

  const createPatientFromInline = useMutation({
    mutationFn: async () => {
      const parts = newPatientName.trim().split(/\s+/);
      const firstName = parts[0] ?? "";
      const middleName =
        parts.length >= 3 ? parts.slice(1, -1).join(" ") : null;
      const lastName = parts.length >= 2 ? parts[parts.length - 1] : null;
      const d = newPatientDobDay === "" ? null : Number(newPatientDobDay);
      const m = newPatientDobMonth === "" ? null : Number(newPatientDobMonth);
      const y = newPatientDobYear === "" ? null : Number(newPatientDobYear);
      const dateOfBirth =
        d != null && m != null && y != null
          ? new Date(Date.UTC(y, m - 1, d))
          : null;
      const created = await trpcClient.patient.create.mutate({
        firstName,
        middleName: middleName || null,
        lastName: lastName || null,
        dateOfBirth,
        dobDay: d,
        dobMonth: m,
        dobYear: y,
        gender: newPatientGender || null,
        phone: newPatientPhone.trim() || null,
      });
      return created;
    },
    onSuccess: (created) => {
      if (!created) return;
      queryClient.invalidateQueries({ queryKey: [["patient"]] });
      selectPatient({
        id: created.id,
        label: formatPatientName(created),
        dobDay: created.dobDay ?? null,
        dobMonth: created.dobMonth ?? null,
        dobYear: created.dobYear ?? null,
      });
      setAddingNewPatient(false);
      setNewPatientName("");
      setNewPatientGender("");
      setNewPatientPhone("");
      setNewPatientDobDay("");
      setNewPatientDobMonth("");
      setNewPatientDobYear("");
    },
    onError: (e) => {
      setServerError(e.message);
    },
  });

  const typedName = trimmedSearch;
  // Authoritative duplicate check against the full DB — the fuzzy `list`
  // result is paginated, so a top-10 miss doesn't mean the patient is
  // absent. This query does an exact full-name match server-side.
  const exactMatchQuery = useQuery({
    ...trpc.patient.findByExactName.queryOptions({ name: typedName || "x" }),
    enabled: open && typedName.length > 0,
  });
  const exactMatchExists = exactMatchQuery.data != null;
  const canQuickCreate =
    typedName.length > 0 && !exactMatchQuery.isLoading && !exactMatchExists;

  const feeOk =
    paymentStatus === "nil" || (feeAmount !== "" && Number(feeAmount) >= 0);
  const receiptDateOk =
    receiptDate === "" || /^\d{4}-\d{2}-\d{2}$/.test(receiptDate);
  const entryDateOk = /^\d{4}-\d{2}-\d{2}$/.test(entryDate);
  const canSubmit =
    patient !== null &&
    entryDateOk &&
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
            <Label htmlFor="entry-date" className="md:text-base">
              Date *
            </Label>
            <CalendarInput
              id="entry-date"
              value={entryDate}
              onChange={(v) => setEntryDate(v || todayLocalIsoDate())}
              max={todayLocalIsoDate()}
              className="w-44 md:h-12 md:text-base"
            />
            <p className="text-xs text-muted-foreground md:text-sm">
              Defaults to today. Tap to open the calendar for back-dated
              entries.
            </p>
          </div>

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
                      const { age, display: dobDisplay } =
                        formatPatientAgeDob(p);
                      const metaParts = [
                        age != null ? `${age} yrs` : null,
                        dobDisplay,
                        p.phone || null,
                      ].filter((s): s is string => Boolean(s));
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() =>
                            selectPatient({
                              id: p.id,
                              label: formatPatientName(p),
                              dobDay: p.dobDay ?? derived?.day ?? null,
                              dobMonth: p.dobMonth ?? derived?.month ?? null,
                              dobYear: p.dobYear ?? derived?.year ?? null,
                            })
                          }
                          className="flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left text-sm hover:bg-accent md:px-4 md:py-3 md:text-base"
                        >
                          <span className="font-medium">
                            {formatPatientName(p)}
                          </span>
                          {metaParts.length > 0 && (
                            <span className="text-xs text-muted-foreground md:text-sm">
                              {metaParts.join(" · ")}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {canQuickCreate && !addingNewPatient && (
                      <button
                        type="button"
                        onClick={() => {
                          setAddingNewPatient(true);
                          setNewPatientName(typedName);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary hover:bg-accent md:px-4 md:py-3 md:text-base"
                      >
                        <UserPlus className="h-4 w-4" />
                        <span>
                          Add new patient: &ldquo;
                          <span className="font-medium">{typedName}</span>
                          &rdquo;
                        </span>
                      </button>
                    )}
                  </div>
                )}
                {addingNewPatient && (
                  <div className="space-y-3 rounded-md border bg-muted/30 p-3 md:p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium md:text-base">
                        New patient
                      </p>
                      <button
                        type="button"
                        onClick={() => setAddingNewPatient(false)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Back to search
                      </button>
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="new-patient-name"
                        className="text-xs md:text-sm"
                      >
                        Full name
                      </Label>
                      <Input
                        id="new-patient-name"
                        type="text"
                        value={newPatientName}
                        onChange={(e) => setNewPatientName(e.target.value)}
                        placeholder="e.g. Satya Dagade"
                        className="md:h-11 md:text-base"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label
                          htmlFor="new-patient-gender"
                          className="text-xs md:text-sm"
                        >
                          Gender
                        </Label>
                        <Select
                          id="new-patient-gender"
                          value={newPatientGender}
                          onChange={(e) =>
                            setNewPatientGender(
                              (e.target.value as Gender | "") || "",
                            )
                          }
                          className="md:h-11 md:text-base"
                        >
                          <option value="">—</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                          <option value="prefer_not_to_say">
                            Prefer not to say
                          </option>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="new-patient-phone"
                          className="text-xs md:text-sm"
                        >
                          Mobile
                        </Label>
                        <Input
                          id="new-patient-phone"
                          type="tel"
                          inputMode="tel"
                          value={newPatientPhone}
                          onChange={(e) => setNewPatientPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="md:h-11 md:text-base"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs md:text-sm">
                        Date of Birth
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={newPatientDobDay}
                          onChange={(e) =>
                            setNewPatientDobDay(
                              sanitizeDigits(e.target.value, 2),
                            )
                          }
                          placeholder="DD"
                          className="w-16 text-center md:h-11 md:text-base"
                        />
                        <span className="text-muted-foreground">/</span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={newPatientDobMonth}
                          onChange={(e) =>
                            setNewPatientDobMonth(
                              sanitizeDigits(e.target.value, 2),
                            )
                          }
                          placeholder="MM"
                          className="w-16 text-center md:h-11 md:text-base"
                        />
                        <span className="text-muted-foreground">/</span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={newPatientDobYear}
                          onChange={(e) =>
                            setNewPatientDobYear(
                              sanitizeDigits(e.target.value, 4),
                            )
                          }
                          placeholder="YYYY"
                          className="w-20 text-center md:h-11 md:text-base"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Year alone is fine — leave day or month blank if
                        unknown.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => createPatientFromInline.mutate()}
                      disabled={
                        !newPatientName.trim() ||
                        createPatientFromInline.isPending
                      }
                      className="w-full md:h-11 md:text-base"
                    >
                      {createPatientFromInline.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Creating
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4" />
                          Create patient
                        </>
                      )}
                    </Button>
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
                Date of Receipt of Fees
              </Label>
              <div className="flex items-center gap-2">
                <CalendarInput
                  id="receipt-date"
                  value={receiptDate}
                  onChange={setReceiptDate}
                  onFocus={() => {
                    if (!receiptDate) setReceiptDate(todayLocalIsoDate());
                  }}
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

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
  Pencil,
  X,
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

type BloodType = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | "";

interface SelectedPatient {
  id: string;
  label: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  dobDay: number | null;
  dobMonth: number | null;
  dobYear: number | null;
  gender: Gender | null;
  bloodType: BloodType;
  phone: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
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
  // Default to Consultation so doctors can save a typical visit with just
  // a patient name, no extra clicks (Manoj msg 1314). The dropdown is still
  // free to be changed for non-consultation services.
  const [serviceType, setServiceType] = useState<string>("Consultation");
  const [feeAmount, setFeeAmount] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("paid");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [receiptDate, setReceiptDate] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  // Inline patient block state — also covers the "create new patient"
  // sub-flow (Manoj msg 917 + 919). For an EXISTING patient these
  // start pre-filled from selectPatient() and stay read-only until
  // the doctor taps the pencil; for a NEW patient they start blank
  // and are editable from the start.
  const [pGender, setPGender] = useState<Gender | "">("");
  const [pBloodType, setPBloodType] = useState<BloodType>("");
  const [pPhone, setPPhone] = useState("");
  const [pAddress, setPAddress] = useState("");
  const [pEmergencyName, setPEmergencyName] = useState("");
  const [pEmergencyPhone, setPEmergencyPhone] = useState("");
  // editingExisting flips read-only → editable for a returning
  // patient (pencil icon). For new patients (no selected `patient`),
  // the block is editable unconditionally.
  const [editingExisting, setEditingExisting] = useState(false);

  // Initial vitals captured at the same time as the register entry.
  // These flow into today's patient_visits row server-side after
  // dailyRegister.create returns.
  const [vWeightKg, setVWeightKg] = useState("");
  const [vBpSystolic, setVBpSystolic] = useState("");
  const [vBpDiastolic, setVBpDiastolic] = useState("");
  const [vSpO2, setVSpO2] = useState("");
  const [vTempCelsius, setVTempCelsius] = useState("");

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
      // Reset to the default so the next open shows Consultation as a
      // SELECTED value, not just a visual default (Manoj msg 1320 #1).
      // Resetting to "" left the <select> displaying "Consultation" (the
      // first option) while state was "", so canSubmit's serviceType !== ""
      // check failed silently — and reselecting "Consultation" from the
      // dropdown didn't fix it because onChange doesn't fire when the
      // DOM value already matches the picked option.
      setServiceType("Consultation");
      setFeeAmount("");
      setPaymentStatus("paid");
      setPaymentMode("cash");
      // Default to today so a reopened dialog with default Paid status
      // shows a populated receipt date instead of an empty field. The
      // [paymentStatus] effect alone wasn't sufficient because deps don't
      // change on close→reopen and it never re-fires (Manoj msg 1384).
      setReceiptDate(todayLocalIsoDate());
      setDiagnosis("");
      setNotes("");
      setServerError(null);
      setPGender("");
      setPBloodType("");
      setPPhone("");
      setPAddress("");
      setPEmergencyName("");
      setPEmergencyPhone("");
      setEditingExisting(false);
      setVWeightKg("");
      setVBpSystolic("");
      setVBpDiastolic("");
      setVSpO2("");
      setVTempCelsius("");
    }
  }, [open, visitDate]);

  // Manoj msg 764 #3: switching to Paid auto-fills today's receipt date
  // (if the field is empty — preserves anything the doctor already
  // typed). Switching to Due clears it so the field reads blank as a
  // visual reminder that fees haven't come in yet.
  useEffect(() => {
    if (paymentStatus === "paid") {
      setReceiptDate((current) => current || todayLocalIsoDate());
    } else if (paymentStatus === "due") {
      setReceiptDate("");
    }
  }, [paymentStatus]);

  function selectPatient(p: SelectedPatient) {
    setPatient(p);
    setDobDay(p.dobDay != null ? String(p.dobDay) : "");
    setDobMonth(p.dobMonth != null ? String(p.dobMonth) : "");
    setDobYear(p.dobYear != null ? String(p.dobYear) : "");
    setPGender(p.gender ?? "");
    setPBloodType(p.bloodType ?? "");
    setPPhone(p.phone ?? "");
    setPAddress(p.address ?? "");
    setPEmergencyName(p.emergencyContactName ?? "");
    setPEmergencyPhone(p.emergencyContactPhone ?? "");
    setEditingExisting(false);
  }

  function clearPatient() {
    setPatient(null);
    setPatientSearch("");
    setDobDay("");
    setDobMonth("");
    setDobYear("");
    setPGender("");
    setPBloodType("");
    setPPhone("");
    setPAddress("");
    setPEmergencyName("");
    setPEmergencyPhone("");
    setEditingExisting(false);
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
      // Build initialVitals from the bottom-of-form fields. Empty
      // strings → undefined so the whole object is omitted when nothing
      // was captured (avoids zero-filling the visit row).
      const wt = vWeightKg.trim();
      const bps = vBpSystolic.trim();
      const bpd = vBpDiastolic.trim();
      const spo2 = vSpO2.trim();
      const temp = vTempCelsius.trim();
      const initialVitals =
        wt || bps || bpd || spo2 || temp
          ? {
              // Carry the form's entryDate so the visit row lands on
              // the back-dated calendar day instead of the server's
              // "today" (Amit review msg 1097 P1).
              visitDate: entryDate,
              weightKg: wt || null,
              bpSystolic: bps ? Number(bps) : null,
              bpDiastolic: bpd ? Number(bpd) : null,
              spO2Percent: spo2 ? Number(spo2) : null,
              temperatureCelsius: temp || null,
            }
          : undefined;

      // Resolve the patient — either the one the doctor selected, or
      // create a brand new one on the fly. For an existing patient
      // whose details were edited via the pencil, patient.update first
      // so the server-side validation can't leave an orphaned entry
      // behind. For a new patient, patient.create carries the full
      // patient block and the initial vitals together.
      let resolved = patient;
      if (!resolved) {
        const typed = trimmedSearch.trim();
        if (!typed) throw new Error("Type a patient name or pick one");
        const parts = typed.split(/\s+/);
        const firstName = parts[0] ?? "";
        const middleName =
          parts.length >= 3 ? parts.slice(1, -1).join(" ") : null;
        const lastName = parts.length >= 2 ? parts[parts.length - 1] : null;
        const d = parsedDob.d;
        const m = parsedDob.m;
        const y = parsedDob.y;
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
          gender: pGender || null,
          bloodType: pBloodType || null,
          phone: pPhone.trim() || null,
          address: pAddress.trim() || null,
          emergencyContactName: pEmergencyName.trim() || null,
          emergencyContactPhone: pEmergencyPhone.trim() || null,
          // initialVitals on patient.create writes today's visit row
          // directly, so the daily-register call below will reuse the
          // same row and not double-write.
          ...(initialVitals ? { initialVitals } : {}),
        });
        if (!created) throw new Error("Could not create patient");
        resolved = {
          id: created.id,
          label: formatPatientName(created),
          firstName: created.firstName,
          middleName: created.middleName ?? null,
          lastName: created.lastName,
          dobDay: created.dobDay ?? null,
          dobMonth: created.dobMonth ?? null,
          dobYear: created.dobYear ?? null,
          gender: (created.gender as Gender | null) ?? null,
          bloodType: (created.bloodType as BloodType | null) ?? "",
          phone: created.phone ?? null,
          address: created.address ?? null,
          emergencyContactName: created.emergencyContactName ?? null,
          emergencyContactPhone: created.emergencyContactPhone ?? null,
        };
        setPatient(resolved);
      } else if (editingExisting) {
        // The pencil was tapped — push the (possibly edited) full
        // patient block, then save DOB-as-partial. Use patient.update
        // for the bulk of fields and rely on the existing updateDob
        // path for partial year-only DOBs.
        const d = parsedDob.d;
        const m = parsedDob.m;
        const y = parsedDob.y;
        const dateOfBirth =
          d != null && m != null && y != null
            ? new Date(Date.UTC(y, m - 1, d))
            : null;
        await trpcClient.patient.update.mutate({
          id: resolved.id,
          data: {
            gender: pGender || null,
            bloodType: pBloodType || null,
            phone: pPhone.trim() || null,
            address: pAddress.trim() || null,
            emergencyContactName: pEmergencyName.trim() || null,
            emergencyContactPhone: pEmergencyPhone.trim() || null,
            dateOfBirth,
            dobDay: d,
            dobMonth: m,
            dobYear: y,
          },
        });
        resolved = {
          ...resolved,
          gender: pGender || null,
          bloodType: pBloodType,
          phone: pPhone.trim() || null,
          address: pAddress.trim() || null,
          emergencyContactName: pEmergencyName.trim() || null,
          emergencyContactPhone: pEmergencyPhone.trim() || null,
          dobDay: d,
          dobMonth: m,
          dobYear: y,
        };
        setPatient(resolved);
      } else if (dobChanged) {
        // Existing patient, not in edit mode but the DOB inputs were
        // touched (legacy path). Save DOB only.
        const updated = await trpcClient.patient.updateDob.mutate({
          id: resolved.id,
          dobDay: parsedDob.d,
          dobMonth: parsedDob.m,
          dobYear: parsedDob.y,
        });
        if (updated) {
          resolved = {
            ...resolved,
            dobDay: updated.dobDay ?? null,
            dobMonth: updated.dobMonth ?? null,
            dobYear: updated.dobYear ?? null,
          };
          setPatient(resolved);
        }
      }

      // Fees Received is now optional (Manoj msg 767 #2). Blank amount
      // saves as 0 so the doctor can record the visit fast and update
      // fees later by reopening.
      const fee =
        paymentStatus === "nil" || feeAmount === "" ? 0 : Number(feeAmount);
      // For NEW patients we already wrote vitals via patient.create's
      // initialVitals, so don't re-send here (would overwrite with the
      // same values, harmless but wasteful). For EXISTING patients,
      // send vitals along with the entry so the same-date visit row
      // gets populated.
      const newPatientPath = patient === null;
      const entry = await trpcClient.dailyRegister.create.mutate({
        patientId: resolved.id,
        visitDate: entryDate,
        serviceType: serviceType || null,
        feeAmount: fee,
        paymentMode,
        paymentStatus,
        feeReceivedAt: receiptDate || null,
        diagnosis: diagnosis.trim() || null,
        notes: notes.trim() || null,
        ...(!newPatientPath && initialVitals ? { initialVitals } : {}),
      });
      return entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["dailyRegister"]] });
      queryClient.invalidateQueries({ queryKey: [["patient"]] });
      queryClient.invalidateQueries({ queryKey: [["patientVisit"]] });
      onOpenChange(false);
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
    paymentStatus === "nil" || feeAmount === "" || Number(feeAmount) >= 0;
  const receiptDateOk =
    receiptDate === "" || /^\d{4}-\d{2}-\d{2}$/.test(receiptDate);
  const entryDateOk = /^\d{4}-\d{2}-\d{2}$/.test(entryDate);
  // A patient is "available" if one is selected OR the doctor has typed a
  // name with no exact match (we'll auto-create on save).
  const patientResolvable =
    patient !== null || (canQuickCreate && typedName.length > 0);
  const canSubmit =
    patientResolvable &&
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
              <ExistingPatientBlock
                patient={patient}
                editing={editingExisting}
                onStartEdit={() => setEditingExisting(true)}
                onCancelEdit={() => {
                  selectPatient(patient);
                }}
                onChange={clearPatient}
                pGender={pGender}
                setPGender={setPGender}
                pBloodType={pBloodType}
                setPBloodType={setPBloodType}
                pPhone={pPhone}
                setPPhone={setPPhone}
                pAddress={pAddress}
                setPAddress={setPAddress}
                dobDay={dobDay}
                dobMonth={dobMonth}
                dobYear={dobYear}
                setDobDay={setDobDay}
                setDobMonth={setDobMonth}
                setDobYear={setDobYear}
                dobError={dobError}
              />
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
                              firstName: p.firstName,
                              middleName: p.middleName ?? null,
                              lastName: p.lastName,
                              dobDay: p.dobDay ?? derived?.day ?? null,
                              dobMonth: p.dobMonth ?? derived?.month ?? null,
                              dobYear: p.dobYear ?? derived?.year ?? null,
                              gender: (p.gender as Gender | null) ?? null,
                              bloodType:
                                (p.bloodType as BloodType | null) ?? "",
                              phone: p.phone ?? null,
                              address: p.address ?? null,
                              emergencyContactName:
                                p.emergencyContactName ?? null,
                              emergencyContactPhone:
                                p.emergencyContactPhone ?? null,
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
                  </div>
                )}
                {canQuickCreate && (
                  <NewPatientBlock
                    typedName={typedName}
                    pGender={pGender}
                    setPGender={setPGender}
                    pBloodType={pBloodType}
                    setPBloodType={setPBloodType}
                    pPhone={pPhone}
                    setPPhone={setPPhone}
                    pAddress={pAddress}
                    setPAddress={setPAddress}
                    dobDay={dobDay}
                    dobMonth={dobMonth}
                    dobYear={dobYear}
                    setDobDay={setDobDay}
                    setDobMonth={setDobMonth}
                    setDobYear={setDobYear}
                    dobError={dobError}
                  />
                )}
              </>
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
              {SERVICE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fee" className="md:text-base">
              Fees Received (₹)
            </Label>
            <div className="flex items-center gap-2">
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
                className="h-10 min-w-0 flex-1 md:h-11 md:text-base"
              />
              <div className="flex flex-none gap-0.5 rounded-md border p-0.5">
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
                    className={`flex items-center gap-1 rounded-sm px-2 py-1.5 text-xs font-medium transition md:px-2.5 md:py-2 md:text-sm ${
                      paymentStatus === key
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    {label}
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
              Diagnosis
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
              Notes / Remarks
            </Label>
            <Textarea
              id="notes"
              rows={2}
              maxLength={1000}
              placeholder="Referral, observations, advice — anything to remember about this visit."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="md:min-h-[5rem] md:text-base"
            />
          </div>

          <div className="space-y-3 rounded-md border bg-muted/30 p-3 md:p-4">
            <p className="text-sm font-medium md:text-base">
              Initial Vitals
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                (optional)
              </span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="v-wt" className="text-xs md:text-sm">
                  Weight (kg)
                </Label>
                <Input
                  id="v-wt"
                  type="text"
                  inputMode="decimal"
                  placeholder="—"
                  value={vWeightKg}
                  onChange={(e) =>
                    setVWeightKg(
                      e.target.value.replace(/[^\d.]/g, "").slice(0, 6),
                    )
                  }
                  className="md:h-11 md:text-base"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-spo2" className="text-xs md:text-sm">
                  SpO2 (%)
                </Label>
                <Input
                  id="v-spo2"
                  type="text"
                  inputMode="numeric"
                  placeholder="—"
                  value={vSpO2}
                  onChange={(e) => setVSpO2(sanitizeDigits(e.target.value, 3))}
                  className="md:h-11 md:text-base"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs md:text-sm">B.P. (mm of Hg)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="systolic"
                  value={vBpSystolic}
                  onChange={(e) =>
                    setVBpSystolic(sanitizeDigits(e.target.value, 3))
                  }
                  className="w-24 text-center md:h-11 md:text-base"
                />
                <span className="text-muted-foreground">/</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="diastolic"
                  value={vBpDiastolic}
                  onChange={(e) =>
                    setVBpDiastolic(sanitizeDigits(e.target.value, 3))
                  }
                  className="w-24 text-center md:h-11 md:text-base"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-temp" className="text-xs md:text-sm">
                Temperature (°C)
              </Label>
              <Input
                id="v-temp"
                type="text"
                inputMode="decimal"
                placeholder="—.—"
                value={vTempCelsius}
                onChange={(e) =>
                  setVTempCelsius(
                    e.target.value.replace(/[^\d.]/g, "").slice(0, 5),
                  )
                }
                className="w-28 md:h-11 md:text-base"
              />
            </div>
          </div>

          <EmergencyContactBlock
            readOnly={patient !== null && !editingExisting}
            pEmergencyName={pEmergencyName}
            setPEmergencyName={setPEmergencyName}
            pEmergencyPhone={pEmergencyPhone}
            setPEmergencyPhone={setPEmergencyPhone}
          />

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

function PatientFieldsForm({
  pGender,
  setPGender,
  pBloodType,
  setPBloodType,
  pPhone,
  setPPhone,
  pAddress,
  setPAddress,
  dobDay,
  dobMonth,
  dobYear,
  setDobDay,
  setDobMonth,
  setDobYear,
  dobError,
  idPrefix,
}: {
  pGender: Gender | "";
  setPGender: (v: Gender | "") => void;
  pBloodType: BloodType;
  setPBloodType: (v: BloodType) => void;
  pPhone: string;
  setPPhone: (v: string) => void;
  pAddress: string;
  setPAddress: (v: string) => void;
  dobDay: string;
  dobMonth: string;
  dobYear: string;
  setDobDay: (v: string) => void;
  setDobMonth: (v: string) => void;
  setDobYear: (v: string) => void;
  dobError: string | null;
  idPrefix: string;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-gender`} className="text-xs md:text-sm">
            Gender
          </Label>
          <Select
            id={`${idPrefix}-gender`}
            value={pGender}
            onChange={(e) => setPGender((e.target.value as Gender | "") || "")}
            className="md:h-11 md:text-base"
          >
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-blood`} className="text-xs md:text-sm">
            Blood Group
          </Label>
          <Select
            id={`${idPrefix}-blood`}
            value={pBloodType}
            onChange={(e) => setPBloodType(e.target.value as BloodType)}
            className="md:h-11 md:text-base"
          >
            <option value="">—</option>
            <option value="A+">A+</option>
            <option value="A-">A-</option>
            <option value="B+">B+</option>
            <option value="B-">B-</option>
            <option value="AB+">AB+</option>
            <option value="AB-">AB-</option>
            <option value="O+">O+</option>
            <option value="O-">O-</option>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs md:text-sm">Date of Birth</Label>
        <div className="flex items-center gap-2">
          <Input
            type="text"
            inputMode="numeric"
            value={dobDay}
            onChange={(e) => setDobDay(sanitizeDigits(e.target.value, 2))}
            placeholder="DD"
            className="w-16 text-center md:h-11 md:text-base"
          />
          <span className="text-muted-foreground">/</span>
          <Input
            type="text"
            inputMode="numeric"
            value={dobMonth}
            onChange={(e) => setDobMonth(sanitizeDigits(e.target.value, 2))}
            placeholder="MM"
            className="w-16 text-center md:h-11 md:text-base"
          />
          <span className="text-muted-foreground">/</span>
          <Input
            type="text"
            inputMode="numeric"
            value={dobYear}
            onChange={(e) => setDobYear(sanitizeDigits(e.target.value, 4))}
            placeholder="YYYY"
            className="w-20 text-center md:h-11 md:text-base"
          />
        </div>
        {dobError && <p className="text-xs text-destructive">{dobError}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-phone`} className="text-xs md:text-sm">
          Mobile
        </Label>
        <Input
          id={`${idPrefix}-phone`}
          type="tel"
          inputMode="tel"
          value={pPhone}
          onChange={(e) => setPPhone(e.target.value)}
          placeholder="+91 98765 43210"
          className="md:h-11 md:text-base"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-address`} className="text-xs md:text-sm">
          Address
        </Label>
        <Textarea
          id={`${idPrefix}-address`}
          rows={2}
          value={pAddress}
          onChange={(e) => setPAddress(e.target.value)}
          placeholder="Street, area, city, pincode"
          className="md:text-base"
        />
      </div>
    </div>
  );
}

function NewPatientBlock(props: {
  typedName: string;
  pGender: Gender | "";
  setPGender: (v: Gender | "") => void;
  pBloodType: BloodType;
  setPBloodType: (v: BloodType) => void;
  pPhone: string;
  setPPhone: (v: string) => void;
  pAddress: string;
  setPAddress: (v: string) => void;
  dobDay: string;
  dobMonth: string;
  dobYear: string;
  setDobDay: (v: string) => void;
  setDobMonth: (v: string) => void;
  setDobYear: (v: string) => void;
  dobError: string | null;
}) {
  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3 md:p-4">
      <p className="flex items-center gap-2 text-sm font-medium md:text-base">
        <UserPlus className="h-4 w-4" />
        New patient: &ldquo;{props.typedName}&rdquo;
      </p>
      <PatientFieldsForm {...props} idPrefix="np" />
    </div>
  );
}

function ExistingPatientBlock(props: {
  patient: SelectedPatient;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onChange: () => void;
  pGender: Gender | "";
  setPGender: (v: Gender | "") => void;
  pBloodType: BloodType;
  setPBloodType: (v: BloodType) => void;
  pPhone: string;
  setPPhone: (v: string) => void;
  pAddress: string;
  setPAddress: (v: string) => void;
  dobDay: string;
  dobMonth: string;
  dobYear: string;
  setDobDay: (v: string) => void;
  setDobMonth: (v: string) => void;
  setDobYear: (v: string) => void;
  dobError: string | null;
}) {
  const {
    patient,
    editing,
    onStartEdit,
    onCancelEdit,
    onChange,
    dobDay,
    dobMonth,
    dobYear,
  } = props;
  const dobDisplay =
    dobDay && dobMonth && dobYear
      ? `${dobDay.padStart(2, "0")}/${dobMonth.padStart(2, "0")}/${dobYear}`
      : dobYear || "—";
  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3 md:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium md:text-base">{patient.label}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={editing ? onCancelEdit : onStartEdit}
            aria-label={editing ? "Cancel edit" : "Edit patient"}
            title={editing ? "Cancel edit" : "Edit patient"}
            className="h-9 w-9 md:h-10 md:w-10"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onChange}
            aria-label="Change patient"
            title="Change patient"
            className="h-9 w-9 md:h-10 md:w-10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {editing ? (
        <PatientFieldsForm {...props} idPrefix="ep" />
      ) : (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs md:text-sm">
          <div>
            <dt className="text-muted-foreground">Gender</dt>
            <dd>{patient.gender ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Blood Group</dt>
            <dd>{patient.bloodType || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Date of Birth</dt>
            <dd>{dobDisplay}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Mobile</dt>
            <dd>{patient.phone ?? "—"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground">Address</dt>
            <dd className="whitespace-pre-wrap">{patient.address ?? "—"}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

function EmergencyContactBlock({
  readOnly,
  pEmergencyName,
  setPEmergencyName,
  pEmergencyPhone,
  setPEmergencyPhone,
}: {
  readOnly: boolean;
  pEmergencyName: string;
  setPEmergencyName: (v: string) => void;
  pEmergencyPhone: string;
  setPEmergencyPhone: (v: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3 md:p-4">
      <p className="text-sm font-medium md:text-base">
        Emergency Contact
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          (optional)
        </span>
      </p>
      {readOnly ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs md:text-sm">
          <div>
            <dt className="text-muted-foreground">Name</dt>
            <dd>{pEmergencyName || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Phone</dt>
            <dd>{pEmergencyPhone || "—"}</dd>
          </div>
        </dl>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="em-name" className="text-xs md:text-sm">
              Contact Name
            </Label>
            <Input
              id="em-name"
              type="text"
              placeholder="—"
              value={pEmergencyName}
              onChange={(e) => setPEmergencyName(e.target.value)}
              className="md:h-11 md:text-base"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="em-phone" className="text-xs md:text-sm">
              Contact Phone
            </Label>
            <Input
              id="em-phone"
              type="tel"
              inputMode="tel"
              placeholder="+91 98765 43210"
              value={pEmergencyPhone}
              onChange={(e) => setPEmergencyPhone(e.target.value)}
              className="md:h-11 md:text-base"
            />
          </div>
        </div>
      )}
    </div>
  );
}

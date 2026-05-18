import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import type { CreatePatient, Gender } from "@docnotes/shared";
import { trpc, trpcClient } from "@/lib/trpc";
import { useDebounce } from "@/hooks/use-debounce";
import { formatPatientName, formatPatientAgeDob } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface NewPatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type BloodType = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | "";

const OVERRIDE_REASON_OPTIONS = [
  "Different person, same name",
  "Spelling correction needed",
  "Other",
] as const;

function sanitizeDigits(value: string, maxLen: number): string {
  return value.replace(/\D/g, "").slice(0, maxLen);
}

function parseFullName(name: string): {
  firstName: string;
  middleName: string | null;
  lastName: string | null;
} {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "";
  const middleName = parts.length >= 3 ? parts.slice(1, -1).join(" ") : null;
  const lastName = parts.length >= 2 ? parts[parts.length - 1]! : null;
  return { firstName, middleName, lastName };
}

export function NewPatientDialog({
  open,
  onOpenChange,
}: NewPatientDialogProps) {
  const queryClient = useQueryClient();

  // Form state (lifted from react-hook-form so the name + DOB partials and
  // the dedup lookups read the same source).
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [dobDay, setDobDay] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobYear, setDobYear] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [bloodType, setBloodType] = useState<BloodType>("");
  const [notes, setNotes] = useState("");
  // Initial vitals captured by the receptionist at registration. When
  // any are filled, they spawn a patient_visits row for today so the
  // values appear in History and in the doctor's view of the day's
  // Daily Register entry. Empty means "no vitals taken".
  const [initialWeightKg, setInitialWeightKg] = useState("");
  const [initialBpSystolic, setInitialBpSystolic] = useState("");
  const [initialBpDiastolic, setInitialBpDiastolic] = useState("");
  const [initialSpO2, setInitialSpO2] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  const [confirmingOverride, setConfirmingOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [overrideReasonOther, setOverrideReasonOther] = useState("");

  useEffect(() => {
    if (open) return;
    setFullName("");
    setGender("");
    setDobDay("");
    setDobMonth("");
    setDobYear("");
    setPhone("");
    setEmail("");
    setAddress("");
    setEmergencyName("");
    setEmergencyPhone("");
    setBloodType("");
    setNotes("");
    setInitialWeightKg("");
    setInitialBpSystolic("");
    setInitialBpDiastolic("");
    setInitialSpO2("");
    setServerError(null);
    setConfirmingOverride(false);
    setOverrideReason("");
    setOverrideReasonOther("");
  }, [open]);

  const trimmedName = fullName.trim();
  const debouncedDupQuery = useDebounce(trimmedName, 300);
  const dupQuery = useQuery({
    ...trpc.patient.list.queryOptions({
      query: debouncedDupQuery || undefined,
      page: 1,
      limit: 5,
    }),
    enabled: open && debouncedDupQuery.length >= 2,
  });

  const phoneDigits = useMemo(() => phone.replace(/\D/g, ""), [phone]);
  const debouncedPhoneDigits = useDebounce(phoneDigits, 300);
  const phoneDupQuery = useQuery({
    ...trpc.patient.findByPhone.queryOptions({
      phone: debouncedPhoneDigits,
    }),
    enabled: open && debouncedPhoneDigits.length >= 6,
  });

  const duplicateCandidates = useMemo(() => {
    const nameMatches = dupQuery.data?.items ?? [];
    const phoneMatches = phoneDupQuery.data ?? [];
    const seen = new Set<string>();
    const merged: typeof nameMatches = [];
    for (const p of [...nameMatches, ...phoneMatches]) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      merged.push(p);
    }
    return merged;
  }, [dupQuery.data, phoneDupQuery.data]);

  const dobError = useMemo(() => {
    const d = dobDay === "" ? null : Number(dobDay);
    const m = dobMonth === "" ? null : Number(dobMonth);
    const y = dobYear === "" ? null : Number(dobYear);
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
  }, [dobDay, dobMonth, dobYear]);

  const canSubmit = trimmedName.length > 0 && dobError === null;

  const createMutation = useMutation({
    mutationFn: (payload: CreatePatient) =>
      trpcClient.patient.create.mutate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["patient"]] });
      onOpenChange(false);
    },
    onError: (err) => {
      setServerError(err.message);
    },
  });

  function buildPayload(overrideReasonText: string | null): CreatePatient {
    const { firstName, middleName, lastName } = parseFullName(fullName);
    const d = dobDay === "" ? null : Number(dobDay);
    const m = dobMonth === "" ? null : Number(dobMonth);
    const y = dobYear === "" ? null : Number(dobYear);
    const dateOfBirth =
      d != null && m != null && y != null
        ? new Date(Date.UTC(y, m - 1, d))
        : null;
    const wt = initialWeightKg.trim();
    const bps = initialBpSystolic.trim();
    const bpd = initialBpDiastolic.trim();
    const spo2 = initialSpO2.trim();
    const initialVitals =
      wt || bps || bpd || spo2
        ? {
            weightKg: wt || null,
            bpSystolic: bps ? Number(bps) : null,
            bpDiastolic: bpd ? Number(bpd) : null,
            spO2Percent: spo2 ? Number(spo2) : null,
          }
        : undefined;
    return {
      firstName,
      middleName: middleName || null,
      lastName: lastName || null,
      dateOfBirth,
      dobDay: d,
      dobMonth: m,
      dobYear: y,
      gender: gender || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      emergencyContactName: emergencyName.trim() || null,
      emergencyContactPhone: emergencyPhone.trim() || null,
      bloodType: bloodType || null,
      notes: notes.trim() || null,
      ...(initialVitals ? { initialVitals } : {}),
      ...(overrideReasonText
        ? {
            duplicateOverride: {
              reason: overrideReasonText,
              candidateIds: duplicateCandidates.map((p) => p.id),
            },
          }
        : {}),
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!canSubmit) return;
    if (duplicateCandidates.length > 0) {
      setOverrideReason("");
      setOverrideReasonOther("");
      setConfirmingOverride(true);
      return;
    }
    createMutation.mutate(buildPayload(null));
  }

  const finalOverrideReason = (
    overrideReason === "Other" ? overrideReasonOther.trim() : overrideReason
  ).trim();
  const canConfirmOverride = finalOverrideReason.length > 0;

  function onConfirmOverride() {
    if (!canConfirmOverride) return;
    createMutation.mutate(buildPayload(finalOverrideReason));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {confirmingOverride
              ? "Possible duplicate — confirm"
              : "New Patient"}
          </DialogTitle>
          <DialogDescription>
            {confirmingOverride
              ? "An existing patient looks similar. Open the existing record, or confirm with a reason to create as new."
              : "Add a new patient. Only Full Name is required."}
          </DialogDescription>
        </DialogHeader>

        {confirmingOverride && (
          <div className="space-y-4">
            {serverError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {serverError}
              </div>
            )}

            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700/50 dark:bg-amber-950/30">
              <p className="mb-2 font-medium text-amber-900 dark:text-amber-200">
                Existing patient(s) matching this name or mobile:
              </p>
              <ul className="space-y-2">
                {duplicateCandidates.map((p) => {
                  const { age, display: dobDisplay } = formatPatientAgeDob(p);
                  const metaParts = [
                    age != null ? `${age} yrs` : null,
                    dobDisplay,
                    p.phone || null,
                  ].filter((s): s is string => Boolean(s));
                  return (
                    <li
                      key={p.id}
                      className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="text-amber-900 dark:text-amber-200">
                        <span className="font-medium">
                          {formatPatientName(p)}
                        </span>
                        {metaParts.length > 0 && (
                          <span className="ml-2 text-xs text-amber-800/80 dark:text-amber-300/80">
                            {metaParts.join(" · ")}
                          </span>
                        )}
                      </div>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="self-start"
                      >
                        <Link
                          href={`/patients/${p.id}`}
                          onClick={() => onOpenChange(false)}
                        >
                          Open existing
                        </Link>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="override-reason">
                Reason for adding as new *
              </Label>
              <Select
                id="override-reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              >
                <option value="">Select a reason</option>
                {OVERRIDE_REASON_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
              {overrideReason === "Other" && (
                <Input
                  type="text"
                  placeholder="Describe the reason"
                  value={overrideReasonOther}
                  onChange={(e) => setOverrideReasonOther(e.target.value)}
                  maxLength={200}
                />
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmingOverride(false)}
                disabled={createMutation.isPending}
              >
                Back to edit
              </Button>
              <Button
                type="button"
                onClick={onConfirmOverride}
                disabled={!canConfirmOverride || createMutation.isPending}
              >
                {createMutation.isPending
                  ? "Creating..."
                  : "Create as new patient"}
              </Button>
            </DialogFooter>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className={confirmingOverride ? "hidden" : "space-y-6"}
        >
          {serverError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          {duplicateCandidates.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700/50 dark:bg-amber-950/30">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1">
                  <p className="font-medium text-amber-900 dark:text-amber-200">
                    Possible existing patient — check before creating a
                    duplicate.
                  </p>
                  <ul className="space-y-1">
                    {duplicateCandidates.map((p) => {
                      const { age, display: dobDisplay } =
                        formatPatientAgeDob(p);
                      const metaParts = [
                        age != null ? `${age} yrs` : null,
                        dobDisplay,
                        p.phone || null,
                      ].filter((s): s is string => Boolean(s));
                      return (
                        <li key={p.id}>
                          <Link
                            href={`/patients/${p.id}`}
                            onClick={() => onOpenChange(false)}
                            className="block text-amber-900 hover:text-amber-700 dark:text-amber-200 dark:hover:text-amber-100"
                          >
                            <span className="underline underline-offset-2">
                              {formatPatientName(p)}
                            </span>
                            {metaParts.length > 0 && (
                              <span className="ml-2 text-xs text-amber-800/80 dark:text-amber-300/80">
                                {metaParts.join(" · ")}
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Personal Information
            </h3>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Satya Dagade"
                autoFocus
                maxLength={500}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select
                  id="gender"
                  value={gender}
                  onChange={(e) =>
                    setGender((e.target.value as Gender | "") || "")
                  }
                >
                  <option value="">—</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bloodType">Blood Type</Label>
                <Select
                  id="bloodType"
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value as BloodType)}
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

            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  value={dobDay}
                  onChange={(e) => setDobDay(sanitizeDigits(e.target.value, 2))}
                  placeholder="DD"
                  className="w-16 text-center"
                />
                <span className="text-muted-foreground">/</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={dobMonth}
                  onChange={(e) =>
                    setDobMonth(sanitizeDigits(e.target.value, 2))
                  }
                  placeholder="MM"
                  className="w-16 text-center"
                />
                <span className="text-muted-foreground">/</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={dobYear}
                  onChange={(e) =>
                    setDobYear(sanitizeDigits(e.target.value, 4))
                  }
                  placeholder="YYYY"
                  className="w-20 text-center"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Year alone is fine — leave day or month blank if unknown.
              </p>
              {dobError && (
                <p className="text-xs text-destructive">{dobError}</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Contact Information
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="patient@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Mobile</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                {!phoneDigits && (
                  <p className="text-xs text-muted-foreground">
                    Recommended — helps catch duplicate patients later.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                placeholder="Full address"
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Initial Vitals
            </h3>
            <p className="text-xs text-muted-foreground">
              Optional. If filled, these flow into today&apos;s visit row so the
              doctor sees them in History and on the Daily Register entry for
              the same day.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="initialWeightKg">Weight (kg)</Label>
                <Input
                  id="initialWeightKg"
                  type="text"
                  inputMode="decimal"
                  placeholder="—"
                  value={initialWeightKg}
                  onChange={(e) =>
                    setInitialWeightKg(
                      e.target.value.replace(/[^\d.]/g, "").slice(0, 6),
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="initialSpO2">SpO2 (%)</Label>
                <Input
                  id="initialSpO2"
                  type="text"
                  inputMode="numeric"
                  placeholder="—"
                  value={initialSpO2}
                  onChange={(e) =>
                    setInitialSpO2(sanitizeDigits(e.target.value, 3))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>B.P. (mm of Hg)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="systolic"
                  value={initialBpSystolic}
                  onChange={(e) =>
                    setInitialBpSystolic(sanitizeDigits(e.target.value, 3))
                  }
                  className="w-24 text-center"
                />
                <span className="text-muted-foreground">/</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="diastolic"
                  value={initialBpDiastolic}
                  onChange={(e) =>
                    setInitialBpDiastolic(sanitizeDigits(e.target.value, 3))
                  }
                  className="w-24 text-center"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Emergency Contact
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="emergencyContactName">Contact Name</Label>
                <Input
                  id="emergencyContactName"
                  placeholder="Emergency contact"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyContactPhone">Contact Phone</Label>
                <Input
                  id="emergencyContactPhone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes about the patient..."
              rows={3}
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
              {createMutation.isPending ? "Creating..." : "Create Patient"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

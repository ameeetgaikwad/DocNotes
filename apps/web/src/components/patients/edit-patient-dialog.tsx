import { useEffect, useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import type { Gender, UpdatePatient } from "@docnotes/shared";
import { trpcClient } from "@/lib/trpc";
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

type BloodType = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | "";

interface EditPatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: {
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    dateOfBirth: string | null;
    dobDay: number | null;
    dobMonth: number | null;
    dobYear: number | null;
    gender: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    bloodType: string | null;
    notes: string | null;
  };
}

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

function joinName(
  firstName: string,
  middleName: string | null,
  lastName: string,
): string {
  return [firstName, middleName, lastName].filter(Boolean).join(" ");
}

export function EditPatientDialog({
  open,
  onOpenChange,
  patient,
}: EditPatientDialogProps) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(
    joinName(patient.firstName, patient.middleName, patient.lastName),
  );
  const [gender, setGender] = useState<Gender | "">(
    (patient.gender as Gender | null) ?? "",
  );
  const [dobDay, setDobDay] = useState(
    patient.dobDay != null ? String(patient.dobDay) : "",
  );
  const [dobMonth, setDobMonth] = useState(
    patient.dobMonth != null ? String(patient.dobMonth) : "",
  );
  const [dobYear, setDobYear] = useState(
    patient.dobYear != null ? String(patient.dobYear) : "",
  );
  const [phone, setPhone] = useState(patient.phone ?? "");
  const [email, setEmail] = useState(patient.email ?? "");
  const [address, setAddress] = useState(patient.address ?? "");
  const [emergencyName, setEmergencyName] = useState(
    patient.emergencyContactName ?? "",
  );
  const [emergencyPhone, setEmergencyPhone] = useState(
    patient.emergencyContactPhone ?? "",
  );
  const [bloodType, setBloodType] = useState<BloodType>(
    (patient.bloodType as BloodType | null) ?? "",
  );
  const [notes, setNotes] = useState(patient.notes ?? "");
  const [serverError, setServerError] = useState<string | null>(null);

  // Re-seed every time the dialog reopens against a (possibly updated)
  // patient row. Avoids stale form state after a save → close → reopen.
  useEffect(() => {
    if (!open) return;
    setFullName(
      joinName(patient.firstName, patient.middleName, patient.lastName),
    );
    setGender((patient.gender as Gender | null) ?? "");
    setDobDay(patient.dobDay != null ? String(patient.dobDay) : "");
    setDobMonth(patient.dobMonth != null ? String(patient.dobMonth) : "");
    setDobYear(patient.dobYear != null ? String(patient.dobYear) : "");
    setPhone(patient.phone ?? "");
    setEmail(patient.email ?? "");
    setAddress(patient.address ?? "");
    setEmergencyName(patient.emergencyContactName ?? "");
    setEmergencyPhone(patient.emergencyContactPhone ?? "");
    setBloodType((patient.bloodType as BloodType | null) ?? "");
    setNotes(patient.notes ?? "");
    setServerError(null);
  }, [open, patient]);

  const trimmedName = fullName.trim();

  const dobError = (() => {
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
  })();

  const canSubmit = trimmedName.length > 0 && dobError === null;

  const saveMutation = useMutation({
    mutationFn: (payload: UpdatePatient) =>
      trpcClient.patient.update.mutate({ id: patient.id, data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["patient"]] });
      onOpenChange(false);
    },
    onError: (err) => setServerError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!canSubmit) return;
    const { firstName, middleName, lastName } = parseFullName(fullName);
    const d = dobDay === "" ? null : Number(dobDay);
    const m = dobMonth === "" ? null : Number(dobMonth);
    const y = dobYear === "" ? null : Number(dobYear);
    const dateOfBirth =
      d != null && m != null && y != null
        ? new Date(Date.UTC(y, m - 1, d))
        : null;
    saveMutation.mutate({
      firstName,
      middleName: middleName || null,
      // patients.last_name is NOT NULL in the DB — patient.create
      // implicitly coerces null→'' but patient.update doesn't, so a
      // single-word edit (where parseFullName returns null) would 500.
      // Coerce here to match the create path (Amit review msg 1097 P1).
      lastName: lastName ?? "",
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
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Patient</DialogTitle>
          <DialogDescription>
            Update patient details. Only Full Name is required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {serverError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Personal Information
            </h3>

            <div className="space-y-2">
              <Label htmlFor="editFullName">Full Name *</Label>
              <Input
                id="editFullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Satya Dagade"
                autoFocus
                maxLength={500}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editGender">Gender</Label>
                <Select
                  id="editGender"
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
                <Label htmlFor="editBloodType">Blood Type</Label>
                <Select
                  id="editBloodType"
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
                <Label htmlFor="editEmail">Email</Label>
                <Input
                  id="editEmail"
                  type="email"
                  placeholder="patient@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editPhone">Mobile</Label>
                <Input
                  id="editPhone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editAddress">Address</Label>
              <Textarea
                id="editAddress"
                placeholder="Full address"
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Emergency Contact
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editEmergencyName">Contact Name</Label>
                <Input
                  id="editEmergencyName"
                  placeholder="Emergency contact"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editEmergencyPhone">Contact Phone</Label>
                <Input
                  id="editEmergencyPhone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="editNotes">Notes</Label>
            <Textarea
              id="editNotes"
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
              disabled={!canSubmit || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

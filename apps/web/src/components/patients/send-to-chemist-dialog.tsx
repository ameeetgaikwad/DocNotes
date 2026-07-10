"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ExternalLink,
  Loader2,
  MessageCircle,
  Send,
  Settings,
} from "lucide-react";
import {
  isNonTabletMedicine,
  normalizeWhatsappNumber,
  parseDurationWithMl,
} from "@docnotes/shared";
import { trpc } from "@/lib/trpc";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from "@/components/ui/responsive-dialog";

interface RxLine {
  medicineName: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  quantity: number | null;
  instructions: string | null;
}

interface PatientLite {
  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: string | null;
  dateOfBirth: Date | string | null;
  dobYear: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: PatientLite;
  visitDate: string; // YYYY-MM-DD
  lines: RxLine[];
}

function formatDateDDMMYYYY(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function calcAge(
  dob: Date | string | null,
  dobYear: number | null,
): number | null {
  if (dob) {
    const d = typeof dob === "string" ? new Date(dob) : dob;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age;
  }
  if (dobYear != null) return new Date().getFullYear() - dobYear;
  return null;
}

// Compact one-line format for each medicine, tuned for pharmacy
// readability on WhatsApp — puts medicine name first, then dosage
// pattern, then meal timing, then × duration, then quantity or ml
// trailer at the end. Reuses the same parseDurationWithMl logic as
// the PDF so ml-encoded rows render cleanly.
function formatLine(l: RxLine, index: number): string {
  const parsed = parseDurationWithMl(l.duration);
  const durationText = parsed.duration;
  const mlValue = parsed.mlValue;
  const bits: string[] = [];
  if (l.dosage) bits.push(l.dosage);
  if (l.frequency) bits.push(`${l.frequency} meals`);
  if (durationText) bits.push(`× ${durationText}`);
  const summary = bits.join(" ");
  const hasQty = l.quantity != null && l.quantity > 0;
  const hasMl = mlValue != null && mlValue > 0;
  let trailer = "";
  if (hasQty && hasMl) {
    trailer = ` (Qty ${l.quantity}, ${mlValue} ml)`;
  } else if (hasMl) {
    trailer = ` (${mlValue} ml)`;
  } else if (hasQty && !isNonTabletMedicine(l.medicineName)) {
    trailer = ` (Qty ${l.quantity})`;
  } else if (hasQty) {
    trailer = ` (Qty ${l.quantity})`;
  }
  const note = l.instructions?.trim()
    ? `\n   Note: ${l.instructions.trim()}`
    : "";
  return `${index + 1}. ${l.medicineName}${summary ? "  " + summary : ""}${trailer}${note}`;
}

function buildWhatsappText({
  doctor,
  patient,
  visitDate,
  lines,
}: {
  doctor: {
    fullName: string;
    clinicName: string;
  } | null;
  patient: PatientLite;
  visitDate: string;
  lines: RxLine[];
}): string {
  const patientName = [patient.firstName, patient.middleName, patient.lastName]
    .filter(Boolean)
    .join(" ");
  const age = calcAge(patient.dateOfBirth, patient.dobYear);
  const sex = patient.gender
    ? patient.gender[0]?.toUpperCase() === "M"
      ? "M"
      : patient.gender[0]?.toUpperCase() === "F"
        ? "F"
        : ""
    : "";
  const meta = [age != null ? `${age}y` : null, sex || null]
    .filter(Boolean)
    .join(", ");

  const doctorHeader = doctor
    ? `Dr. ${doctor.fullName.replace(/^\s*(dr\.?|DR\.?)\s+/i, "").trim()}${
        doctor.clinicName ? `, ${doctor.clinicName}` : ""
      }`
    : "";

  const rxBody = lines.map((l, i) => formatLine(l, i)).join("\n");

  const parts = [
    doctorHeader,
    `Patient: ${patientName}${meta ? ` (${meta})` : ""}`,
    `Date: ${formatDateDDMMYYYY(visitDate)}`,
    "",
    "Rx:",
    rxBody,
    "",
    "Please prepare and hold. Patient will collect.",
    "- ClinikNote",
  ].filter((p) => p !== null);

  return parts.join("\n");
}

interface ChemistOption {
  id: string;
  name: string;
  whatsappNumber: string;
  notes: string | null;
}

export function SendToChemistDialog({
  open,
  onOpenChange,
  patient,
  visitDate,
  lines,
}: Props) {
  const chemistsQuery = useQuery({
    ...trpc.chemist.list.queryOptions(),
    enabled: open,
  });
  const doctorQuery = useQuery({
    ...trpc.doctorProfile.me.queryOptions(),
    enabled: open,
  });
  const [pending, setPending] = useState<string | null>(null);

  const rxText = useMemo(
    () =>
      buildWhatsappText({
        doctor: doctorQuery.data
          ? {
              fullName: doctorQuery.data.fullName,
              clinicName: doctorQuery.data.clinicName,
            }
          : null,
        patient,
        visitDate,
        lines,
      }),
    [doctorQuery.data, patient, visitDate, lines],
  );

  function sendToChemist(c: ChemistOption) {
    setPending(c.id);
    const number = normalizeWhatsappNumber(c.whatsappNumber);
    const url = `https://wa.me/${number}?text=${encodeURIComponent(rxText)}`;
    // Open in a new tab. On Android inside the TWA, WhatsApp's deep
    // link intercepts wa.me and launches the app directly. On desktop
    // it opens web.whatsapp.com with the message prefilled.
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Give the transition a beat, then close.
    setTimeout(() => {
      setPending(null);
      onOpenChange(false);
    }, 800);
  }

  const chemists = (chemistsQuery.data ?? []) as ChemistOption[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Send Rx to Chemist
          </DialogTitle>
        </DialogHeader>

        {chemistsQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : chemists.length === 0 ? (
          <div className="space-y-3">
            <p className="rounded-md border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
              You haven&apos;t saved any chemists yet. Add one in Settings, then
              come back here to send the Rx in one tap.
            </p>
            <Link
              href="/settings"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <Settings className="h-4 w-4" /> Open Settings → Chemists
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Pick a chemist. WhatsApp opens with the Rx text prefilled — tap
              send there.
            </p>
            <ul className="space-y-2">
              {chemists.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => sendToChemist(c)}
                    disabled={pending !== null}
                    className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left hover:bg-accent disabled:opacity-60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.whatsappNumber}
                        {c.notes && <> · {c.notes}</>}
                      </p>
                    </div>
                    {pending === c.id ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                    ) : (
                      <Send className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
            <p className="pt-2 text-[11px] text-muted-foreground">
              Manage saved chemists in{" "}
              <Link href="/settings" className="text-primary hover:underline">
                Settings
              </Link>
              .
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

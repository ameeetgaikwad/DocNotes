"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Loader2, AlertCircle, BookOpen, Save, Pill } from "lucide-react";
import { trpc, trpcClient } from "@/lib/trpc";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HomeopathicMedicinePicker } from "@/components/patients/homeopathic-medicine-picker";

interface PatientHistoryProps {
  patientId: string;
}

type Visit = {
  id: string;
  visitDate: string;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  heartRate: number | null;
  bslFasting: string | null;
  bslPostprandial: string | null;
  bslRandom: string | null;
  temperatureCelsius: string | null;
  weightKg: string | null;
  heightCm: string | null;
  clinicalNotes: string | null;
};

export function PatientHistory({ patientId }: PatientHistoryProps) {
  const { data, isLoading, error } = useQuery(
    trpc.patientVisit.listByPatient.queryOptions({ patientId }),
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <AlertCircle className="mb-3 h-8 w-8 text-destructive/60" />
          <p className="font-medium">Failed to load history</p>
          <p className="text-sm">
            {error.message.includes("UNAUTHORIZED")
              ? "Please sign in"
              : "Check your connection and try again"}
          </p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <BookOpen className="mb-3 h-12 w-12" />
          <p className="text-lg font-medium">No visits yet</p>
          <p className="text-sm">
            A visit is created automatically when you add a Daily Register entry
            for this patient.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {data.length} visit{data.length !== 1 && "s"}
      </p>
      {data.map((visit, index) => (
        <VisitCard
          key={visit.id}
          visit={visit}
          isLatest={index === 0}
          patientId={patientId}
        />
      ))}
    </div>
  );
}

/**
 * Best-effort parser for follow-up phrases inside a clinical-notes
 * blob. Looks for "<verb> <something>? after <N> <unit>" where verb
 * is a follow-up word (repeat, follow-up, review, recall, next visit,
 * come back, return) and unit is day/week/month/year. Returns the
 * matched phrase + the computed target date relative to `from`, or
 * null when nothing follow-up-shaped is in the text.
 *
 * Examples that match (case-insensitive):
 *   "Inj B12 repeat after 1 month"
 *   "Follow-up after 2 weeks"
 *   "Review in 10 days"
 *   "Recall after 6 months"
 */
function detectFollowUp(
  notes: string,
  from: Date,
): { matchText: string; date: Date; unitCount: number; unit: string } | null {
  if (!notes || !notes.trim()) return null;
  const re =
    /(?:repeat|follow[\s-]?up|review|recall|return|come\s*back|next\s+visit)[^.\n]{0,40}?(?:after|in)\s+(\d+)\s+(day|week|month|year)s?/i;
  const m = re.exec(notes);
  if (!m) return null;
  const count = Number(m[1]);
  const unit = (m[2] ?? "").toLowerCase();
  if (!Number.isFinite(count) || count <= 0 || count > 365) return null;
  const target = new Date(from);
  if (unit === "day") target.setDate(target.getDate() + count);
  else if (unit === "week") target.setDate(target.getDate() + count * 7);
  else if (unit === "month") target.setMonth(target.getMonth() + count);
  else if (unit === "year") target.setFullYear(target.getFullYear() + count);
  else return null;
  // Anchor to 9am local for the appointment time.
  target.setHours(9, 0, 0, 0);
  return { matchText: m[0], date: target, unitCount: count, unit };
}

function VisitCard({
  visit,
  isLatest,
  patientId,
}: {
  visit: Visit;
  isLatest: boolean;
  patientId: string;
}) {
  const queryClient = useQueryClient();
  const initial = visitToForm(visit);
  const [form, setForm] = useState(initial);
  // editAll = true means all fields are visible (empty included) AND the
  // Save / Discard buttons are usable. The latest visit defaults to true
  // so the doctor can fill in today's data without an extra click; older
  // visits default to false to keep the timeline clean.
  const [editAll, setEditAll] = useState(isLatest);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [followUpToast, setFollowUpToast] = useState<{
    text: string;
    when: string;
  } | null>(null);

  function insertHomeopathicLines(lines: string[]) {
    const current = form.clinicalNotes;
    const insertion = lines.join("\n");
    const next = current.trim()
      ? `${current.replace(/\s+$/, "")}\n${insertion}`
      : insertion;
    setForm((prev) => ({ ...prev, clinicalNotes: next }));
  }

  useEffect(() => {
    setForm(visitToForm(visit));
  }, [visit]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await trpcClient.patientVisit.update.mutate({
        id: visit.id,
        data: formToPatch(form),
      });
      // Manoj msg 879: if the clinical notes have a "repeat after X /
      // follow-up after X" phrase, auto-create a Next Visit appointment
      // for that date. Failures here don't block the visit save.
      const followUp = detectFollowUp(
        form.clinicalNotes,
        new Date(visit.visitDate),
      );
      if (followUp) {
        try {
          await trpcClient.appointment.create.mutate({
            patientId,
            type: "follow_up",
            scheduledAt: followUp.date,
            durationMinutes: 15,
            reason: followUp.matchText,
            notes: null,
          });
          return { followUp };
        } catch {
          return { followUp: null };
        }
      }
      return { followUp: null };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [["patientVisit"]] });
      queryClient.invalidateQueries({ queryKey: [["appointment"]] });
      // Manoj msg 795: after saving, collapse back to read-only mode —
      // Save button disappears and only reappears via "Edit fields".
      setEditAll(false);
      if (result.followUp) {
        const f = result.followUp;
        setFollowUpToast({
          text: f.matchText,
          when: f.date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
        });
        window.setTimeout(() => setFollowUpToast(null), 8000);
      }
    },
  });

  const dirty = !sameForm(form, initial);
  const showAllFields = editAll;
  const showBp =
    showAllFields || form.bpSystolic !== "" || form.bpDiastolic !== "";
  const showHr = showAllFields || form.heartRate !== "";
  const showBslF = showAllFields || form.bslFasting !== "";
  const showBslPp = showAllFields || form.bslPostprandial !== "";
  const showBslR = showAllFields || form.bslRandom !== "";
  const showTemp = showAllFields || form.temperatureCelsius !== "";
  const showWt = showAllFields || form.weightKg !== "";
  const showHt = showAllFields || form.heightCm !== "";
  const showVitalsRow1 = showBp || showHr;
  const showVitalsRow2 = showBslF || showBslPp || showBslR;
  const showVitalsRow3 = showTemp || showWt || showHt;
  const showNotes = showAllFields || form.clinicalNotes !== "";

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold md:text-lg">
          {formatDate(visit.visitDate)}
        </h3>
        <div className="flex items-center gap-3">
          {dirty && (
            <span className="text-xs text-muted-foreground">
              Unsaved changes
            </span>
          )}
          <button
            type="button"
            onClick={() => setEditAll((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {editAll ? "Hide empty" : "Edit fields"}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {showVitalsRow1 && (
          <div className="flex flex-wrap items-end gap-3 md:gap-4">
            {showBp && (
              <FieldGroup label="B.P. (mm of Hg)" htmlFor={`${visit.id}-bps`}>
                <div className="flex items-center gap-1">
                  <NumInput
                    id={`${visit.id}-bps`}
                    value={form.bpSystolic}
                    onChange={(v) => setForm({ ...form, bpSystolic: v })}
                    placeholder="—"
                    className="w-16"
                  />
                  <span className="text-muted-foreground">/</span>
                  <NumInput
                    value={form.bpDiastolic}
                    onChange={(v) => setForm({ ...form, bpDiastolic: v })}
                    placeholder="—"
                    className="w-16"
                  />
                </div>
              </FieldGroup>
            )}
            {showHr && (
              <FieldGroup label="H.R. (/min)" htmlFor={`${visit.id}-hr`}>
                <NumInput
                  id={`${visit.id}-hr`}
                  value={form.heartRate}
                  onChange={(v) => setForm({ ...form, heartRate: v })}
                  placeholder="—"
                  className="w-20"
                />
              </FieldGroup>
            )}
          </div>
        )}

        {showVitalsRow2 && (
          <div className="flex flex-wrap items-end gap-3 md:gap-4">
            {showBslF && (
              <FieldGroup label="B.S.L. F (mg/dL)" htmlFor={`${visit.id}-bslf`}>
                <NumInput
                  id={`${visit.id}-bslf`}
                  value={form.bslFasting}
                  onChange={(v) => setForm({ ...form, bslFasting: v })}
                  placeholder="—"
                  className="w-20"
                />
              </FieldGroup>
            )}
            {showBslPp && (
              <FieldGroup label="P.P." htmlFor={`${visit.id}-bslp`}>
                <NumInput
                  id={`${visit.id}-bslp`}
                  value={form.bslPostprandial}
                  onChange={(v) => setForm({ ...form, bslPostprandial: v })}
                  placeholder="—"
                  className="w-20"
                />
              </FieldGroup>
            )}
            {showBslR && (
              <FieldGroup label="R" htmlFor={`${visit.id}-bslr`}>
                <NumInput
                  id={`${visit.id}-bslr`}
                  value={form.bslRandom}
                  onChange={(v) => setForm({ ...form, bslRandom: v })}
                  placeholder="—"
                  className="w-20"
                />
              </FieldGroup>
            )}
          </div>
        )}

        {showVitalsRow3 && (
          <div className="flex flex-wrap items-end gap-3 md:gap-4">
            {showTemp && (
              <FieldGroup label="Temp. (°C)" htmlFor={`${visit.id}-temp`}>
                <NumInput
                  id={`${visit.id}-temp`}
                  value={form.temperatureCelsius}
                  onChange={(v) => setForm({ ...form, temperatureCelsius: v })}
                  placeholder="—.—"
                  className="w-20"
                />
              </FieldGroup>
            )}
            {showWt && (
              <FieldGroup label="Wt. (Kg)" htmlFor={`${visit.id}-wt`}>
                <NumInput
                  id={`${visit.id}-wt`}
                  value={form.weightKg}
                  onChange={(v) => setForm({ ...form, weightKg: v })}
                  placeholder="—"
                  className="w-20"
                />
              </FieldGroup>
            )}
            {showHt && (
              <FieldGroup label="Ht. (cm)" htmlFor={`${visit.id}-ht`}>
                <NumInput
                  id={`${visit.id}-ht`}
                  value={form.heightCm}
                  onChange={(v) => setForm({ ...form, heightCm: v })}
                  placeholder="—"
                  className="w-20"
                />
              </FieldGroup>
            )}
          </div>
        )}

        {showNotes && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={`${visit.id}-notes`} className="md:text-base">
                Clinical notes
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPickerOpen(true)}
                className="h-7 px-2 text-xs"
                title="Insert homeopathic medicine"
              >
                <Pill className="h-3.5 w-3.5" />H
              </Button>
            </div>
            <Textarea
              id={`${visit.id}-notes`}
              rows={6}
              maxLength={20000}
              placeholder="Symptoms, examination findings, plan, medications, advice…"
              value={form.clinicalNotes}
              onChange={(e) =>
                setForm({ ...form, clinicalNotes: e.target.value })
              }
              className="md:min-h-[10rem] md:text-base"
            />
          </div>
        )}

        <HomeopathicMedicinePicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onInsert={insertHomeopathicLines}
        />
      </div>

      {saveMutation.error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {saveMutation.error.message}
        </div>
      )}

      {followUpToast && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-700/50 dark:bg-emerald-950/30">
          <p className="font-medium text-emerald-900 dark:text-emerald-200">
            Follow-up reminder created for {followUpToast.when}
          </p>
          <p className="mt-0.5 text-xs text-emerald-800 dark:text-emerald-300">
            Picked up &ldquo;{followUpToast.text}&rdquo; from your notes — see
            the Schedule tab or Reminders → Next Visit Reminders.
          </p>
        </div>
      )}

      {editAll && (
        <div className="flex justify-end gap-2">
          {dirty && !saveMutation.isPending && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setForm(initial)}
              className="md:h-11 md:px-5 md:text-base"
            >
              Discard
            </Button>
          )}
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={!dirty || saveMutation.isPending}
            className="md:h-11 md:px-5 md:text-base"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving
              </>
            ) : (
              <>
                <Save className="h-4 w-4" /> Save Visit
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function FieldGroup({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function NumInput({
  id,
  value,
  onChange,
  placeholder,
  className,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(sanitizeDecimal(e.target.value))}
      className={`text-center ${className ?? ""}`}
    />
  );
}

function sanitizeDecimal(s: string): string {
  // Allow digits and a single decimal point.
  const cleaned = s.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return parts[0] + "." + parts.slice(1).join("").slice(0, 2);
}

type VisitFormState = {
  bpSystolic: string;
  bpDiastolic: string;
  heartRate: string;
  bslFasting: string;
  bslPostprandial: string;
  bslRandom: string;
  temperatureCelsius: string;
  weightKg: string;
  heightCm: string;
  clinicalNotes: string;
};

function visitToForm(v: Visit): VisitFormState {
  return {
    bpSystolic: v.bpSystolic != null ? String(v.bpSystolic) : "",
    bpDiastolic: v.bpDiastolic != null ? String(v.bpDiastolic) : "",
    heartRate: v.heartRate != null ? String(v.heartRate) : "",
    bslFasting: v.bslFasting ?? "",
    bslPostprandial: v.bslPostprandial ?? "",
    bslRandom: v.bslRandom ?? "",
    temperatureCelsius: v.temperatureCelsius ?? "",
    weightKg: v.weightKg ?? "",
    heightCm: v.heightCm ?? "",
    clinicalNotes: v.clinicalNotes ?? "",
  };
}

function sameForm(a: VisitFormState, b: VisitFormState): boolean {
  return (
    a.bpSystolic === b.bpSystolic &&
    a.bpDiastolic === b.bpDiastolic &&
    a.heartRate === b.heartRate &&
    a.bslFasting === b.bslFasting &&
    a.bslPostprandial === b.bslPostprandial &&
    a.bslRandom === b.bslRandom &&
    a.temperatureCelsius === b.temperatureCelsius &&
    a.weightKg === b.weightKg &&
    a.heightCm === b.heightCm &&
    a.clinicalNotes === b.clinicalNotes
  );
}

function emptyToNull(s: string): string | null {
  const t = s.trim();
  return t === "" ? null : t;
}

function toIntOrNull(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function formToPatch(f: VisitFormState) {
  return {
    bpSystolic: toIntOrNull(f.bpSystolic),
    bpDiastolic: toIntOrNull(f.bpDiastolic),
    heartRate: toIntOrNull(f.heartRate),
    bslFasting: emptyToNull(f.bslFasting),
    bslPostprandial: emptyToNull(f.bslPostprandial),
    bslRandom: emptyToNull(f.bslRandom),
    temperatureCelsius: emptyToNull(f.temperatureCelsius),
    weightKg: emptyToNull(f.weightKg),
    heightCm: emptyToNull(f.heightCm),
    clinicalNotes: emptyToNull(f.clinicalNotes),
  };
}

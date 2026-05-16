"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Loader2, AlertCircle, BookOpen, Save } from "lucide-react";
import { trpc, trpcClient } from "@/lib/trpc";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
        <VisitCard key={visit.id} visit={visit} isLatest={index === 0} />
      ))}
    </div>
  );
}

function VisitCard({ visit, isLatest }: { visit: Visit; isLatest: boolean }) {
  const queryClient = useQueryClient();
  const initial = visitToForm(visit);
  const [form, setForm] = useState(initial);
  // editAll = true means all fields are visible (empty included) AND the
  // Save / Discard buttons are usable. The latest visit defaults to true
  // so the doctor can fill in today's data without an extra click; older
  // visits default to false to keep the timeline clean.
  const [editAll, setEditAll] = useState(isLatest);

  useEffect(() => {
    setForm(visitToForm(visit));
  }, [visit]);

  const saveMutation = useMutation({
    mutationFn: () =>
      trpcClient.patientVisit.update.mutate({
        id: visit.id,
        data: formToPatch(form),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["patientVisit"]] });
      // Manoj msg 795: after saving, collapse back to read-only mode —
      // Save button disappears and only reappears via "Edit fields".
      setEditAll(false);
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
            <Label htmlFor={`${visit.id}-notes`} className="md:text-base">
              Clinical notes
            </Label>
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
      </div>

      {saveMutation.error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {saveMutation.error.message}
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

"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Loader2,
  Plus,
  Trash2,
  Printer,
  Save,
  Sparkles,
} from "lucide-react";
import {
  DOSAGE_PRESETS,
  DURATION_UNITS,
  MEAL_TIMINGS,
  isNonTabletMedicine,
  type DurationUnit,
  type MealTiming,
} from "@docnotes/shared";
import { trpc, trpcClient } from "@/lib/trpc";
import {
  formatPatientName,
  formatPatientAgeDob,
  todayLocalIsoDate,
  formatGender,
} from "@/lib/format";
import { downloadBase64File, printBase64Pdf } from "@/lib/download";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface RxRow {
  id: string; // client key for React list rendering
  // Server row id when this row was loaded from the DB; undefined for
  // rows the doctor added in this session. Sent to the backend so the
  // upsert can diff instead of wiping the visit's Rx (Manoj msg 2081).
  serverId?: string;
  medicineName: string;
  dosage: string;
  customDosage: boolean;
  meal: MealTiming | "";
  durationValue: string;
  durationUnit: DurationUnit;
  quantity: string;
  quantityManuallyEdited: boolean;
  note: string;
}

function emptyRow(): RxRow {
  return {
    id: crypto.randomUUID(),
    serverId: undefined,
    medicineName: "",
    dosage: "",
    customDosage: false,
    meal: "",
    durationValue: "",
    durationUnit: "days",
    quantity: "",
    quantityManuallyEdited: false,
    note: "",
  };
}

function autoQuantity(row: RxRow): number | null {
  // Manoj msg 2075 + 2080: for suspensions/syrups/drops/injections/
  // creams the dosage × duration math doesn't produce a meaningful
  // tablet count. Skip auto-compute for these; the doctor fills in
  // bottles/ml manually (or leaves blank).
  if (isNonTabletMedicine(row.medicineName)) return null;
  // Sum the dosage parts (e.g. "1-0-1" → 2) and multiply by duration
  // in days. Falls back to null on any parse issue.
  const parts = row.dosage
    .split("-")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
  if (parts.length !== 3) return null;
  const perDay = parts.reduce((a, b) => a + b, 0);
  const d = Number(row.durationValue);
  if (!Number.isFinite(d) || d <= 0) return null;
  const factor =
    row.durationUnit === "days" ? 1 : row.durationUnit === "weeks" ? 7 : 30;
  const total = perDay * d * factor;
  return Math.max(0, Math.round(total));
}

function combineDuration(row: RxRow): string | null {
  const d = row.durationValue.trim();
  if (!d) return null;
  return `${d} ${row.durationUnit}`;
}

export default function PrescribePage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const visitDateParam = searchParams.get("date") ?? todayLocalIsoDate();

  const patientQuery = useQuery(
    trpc.patient.getById.queryOptions({ id: patientId }),
  );
  // Force fresh fetches on mount so a doctor reopening the Rx page
  // for a second Rx session on the same day always sees the earlier
  // saved lines instead of stale cache (Manoj msg 2081).
  const visitsQuery = useQuery({
    ...trpc.patientVisit.listByPatient.queryOptions({ patientId }),
    refetchOnMount: "always",
  });
  const frequentlyUsedQuery = useQuery(
    trpc.prescriptionLine.frequentlyUsed.queryOptions(),
  );

  const todaysVisit = useMemo(() => {
    return (
      visitsQuery.data?.find((v) => v.visitDate === visitDateParam) ?? null
    );
  }, [visitsQuery.data, visitDateParam]);

  const existingLinesQuery = useQuery({
    ...trpc.prescriptionLine.listByVisit.queryOptions({
      visitId: todaysVisit?.id ?? "",
    }),
    enabled: !!todaysVisit?.id,
    refetchOnMount: "always",
  });

  const [rows, setRows] = useState<RxRow[]>(() => [emptyRow()]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  // The server hydration must only happen ONCE per page load; otherwise
  // a background refetch (after Save, cache-invalidation, etc.) would
  // clobber whatever the doctor is currently typing (Manoj msg 2083
  // root cause). Any user typing that happened before the initial
  // hydration is preserved by prepending it before the server rows.
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    if (hasHydrated) return;
    if (!existingLinesQuery.data) return;
    if (existingLinesQuery.data.length === 0) {
      setHasHydrated(true);
      return;
    }
    // Preserve any typing the doctor started before server data arrived
    // (fast typers on slow connections). Non-empty user rows go FIRST,
    // then the server-loaded existing rows follow.
    const dirtyUserRows = rows.filter((r) => r.medicineName.trim() !== "");
    setRows([
      ...dirtyUserRows,
      ...existingLinesQuery.data.map((l) => {
        const isPreset = DOSAGE_PRESETS.includes(
          l.dosage as (typeof DOSAGE_PRESETS)[number],
        );
        // Manoj msg 2080: wipe stale wrong quantities on non-tablet
        // medicines that were auto-populated before the syrup-detection
        // fix landed. Doctors who need to record "1 bottle" can retype
        // the number after the row loads.
        const stalePillCount =
          isNonTabletMedicine(l.medicineName) && (l.quantity ?? 0) > 0;
        const row: RxRow = {
          id: l.id,
          serverId: l.id,
          medicineName: l.medicineName,
          dosage: l.dosage ?? "",
          customDosage: !isPreset && (l.dosage ?? "") !== "",
          meal:
            l.frequency &&
            MEAL_TIMINGS.includes(l.frequency as (typeof MEAL_TIMINGS)[number])
              ? (l.frequency as MealTiming)
              : "",
          durationValue: l.duration ? (l.duration.split(" ")[0] ?? "") : "",
          durationUnit:
            l.duration && l.duration.includes("weeks")
              ? "weeks"
              : l.duration && l.duration.includes("months")
                ? "months"
                : "days",
          quantity:
            stalePillCount || l.quantity == null ? "" : String(l.quantity),
          quantityManuallyEdited: !stalePillCount,
          note: l.instructions ?? "",
        };
        return row;
      }),
    ]);
    setHasHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingLinesQuery.data, hasHydrated]);

  function updateRow(id: string, patch: Partial<RxRow>) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        // Auto-recompute quantity when the name, dosage, or duration
        // changes (name matters because syrups/injections/creams skip
        // the tablet math per Manoj msg 2075). Manual edits stick.
        if (
          !next.quantityManuallyEdited &&
          ("medicineName" in patch ||
            "dosage" in patch ||
            "durationValue" in patch ||
            "durationUnit" in patch)
        ) {
          const q = autoQuantity(next);
          next.quantity = q != null ? String(q) : "";
        }
        return next;
      }),
    );
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      setSaveError(null);
      const lines = rows
        .filter((r) => r.medicineName.trim().length > 0)
        .map((r) => ({
          id: r.serverId,
          medicineName: r.medicineName.trim(),
          dosage: r.dosage.trim() || null,
          frequency: r.meal || null,
          duration: combineDuration(r),
          quantity: r.quantity ? Number(r.quantity) : null,
          instructions: r.note.trim() || null,
        }));
      const result = await trpcClient.prescriptionLine.upsert.mutate({
        patientId,
        visitDate: visitDateParam,
        lines,
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["patientVisit"]] });
      queryClient.invalidateQueries({ queryKey: [["prescriptionLine"]] });
      // Manoj msg 2085: give the Save button visible feedback that the
      // action landed — swap in a "Saved ✓" state briefly.
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2500);
    },
    onError: (e) => setSaveError(e.message),
  });

  const printMutation = useMutation({
    mutationFn: async (action: "print" | "download") => {
      // Save first so the PDF picks up the freshest data.
      const saved = await trpcClient.prescriptionLine.upsert.mutate({
        patientId,
        visitDate: visitDateParam,
        lines: rows
          .filter((r) => r.medicineName.trim().length > 0)
          .map((r) => ({
            medicineName: r.medicineName.trim(),
            dosage: r.dosage.trim() || null,
            frequency: r.meal || null,
            duration: combineDuration(r),
            quantity: r.quantity ? Number(r.quantity) : null,
            instructions: r.note.trim() || null,
          })),
      });
      if (!saved.visitId) {
        // Nothing was saved — skip the print. This should only fire if
        // the doctor tapped Save & Print with all rows empty, in which
        // case the disabled state has already gated the button.
        return;
      }
      const pdf = await trpcClient.export.prescription.mutate({
        visitId: saved.visitId,
      });
      if (action === "print") {
        printBase64Pdf(pdf.base64);
      } else {
        downloadBase64File(pdf.base64, pdf.filename, "application/pdf");
      }
    },
    onError: (e) => setSaveError(e.message),
  });

  if (patientQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!patientQuery.data) {
    return (
      <div className="p-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <p className="mt-4">Patient not found.</p>
      </div>
    );
  }

  const patient = patientQuery.data;
  const { age, display: dobDisplay } = formatPatientAgeDob(patient);
  const patientMeta = [
    formatGender(patient.gender),
    age != null ? `${age} y` : null,
    dobDisplay,
  ]
    .filter(Boolean)
    .join(" · ");

  // Vitals block — Manoj msg 2092 wants them in the header. Pull from
  // today's visit row when present so the prescription writer has the
  // BP / weight / SpO2 in view without hopping to History.
  const vitals: string[] = [];
  if (todaysVisit) {
    if (todaysVisit.bpSystolic != null && todaysVisit.bpDiastolic != null) {
      vitals.push(`BP ${todaysVisit.bpSystolic}/${todaysVisit.bpDiastolic}`);
    }
    if (todaysVisit.heartRate != null) {
      vitals.push(`HR ${todaysVisit.heartRate}`);
    }
    if (todaysVisit.spO2Percent != null) {
      vitals.push(`SpO2 ${todaysVisit.spO2Percent}%`);
    }
    if (todaysVisit.weightKg) vitals.push(`Wt ${todaysVisit.weightKg}kg`);
    if (todaysVisit.temperatureCelsius) {
      vitals.push(`Temp ${todaysVisit.temperatureCelsius}°C`);
    }
  }

  const chips = frequentlyUsedQuery.data ?? [];
  const canPrint =
    rows.some((r) => r.medicineName.trim().length > 0) &&
    !saveMutation.isPending;

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="text-xs text-muted-foreground sm:text-sm">
          {visitDateParam}
        </div>
      </div>

      {/* Paper-style header: name at top, meta underneath, vitals row,
          then a horizontal rule and an "Rx" heading — Manoj msg 2092. */}
      <div className="mb-4 rounded-xl border bg-card p-4 sm:p-5">
        <h1 className="text-lg font-semibold sm:text-xl">
          {formatPatientName(patient)}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{patientMeta}</p>
        {vitals.length > 0 && (
          <p className="mt-1 font-mono text-xs text-muted-foreground sm:text-sm">
            {vitals.join(" · ")}
          </p>
        )}
        <div className="mt-3 border-t pt-2 text-lg font-semibold italic text-primary">
          Rx
        </div>
      </div>

      {chips.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3 w-3" /> Frequently used
          </span>
          {chips.map((c) => (
            <button
              key={c.medicineName}
              type="button"
              onClick={() =>
                setRows((prev) => {
                  const empty = prev.find(
                    (r) => r.medicineName.trim().length === 0,
                  );
                  if (empty) {
                    return prev.map((r) =>
                      r.id === empty.id
                        ? { ...r, medicineName: c.medicineName }
                        : r,
                    );
                  }
                  return [
                    ...prev,
                    { ...emptyRow(), medicineName: c.medicineName },
                  ];
                })
              }
              className="rounded-full border bg-card px-2.5 py-0.5 text-xs hover:bg-accent"
            >
              {c.medicineName}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {rows.map((row, idx) => (
          <RxRowEditor
            key={row.id}
            row={row}
            index={idx}
            canRemove={rows.length > 1}
            onChange={(patch) => updateRow(row.id, patch)}
            onRemove={() =>
              setRows((prev) => prev.filter((r) => r.id !== row.id))
            }
          />
        ))}
      </div>

      <Button
        type="button"
        variant="ghost"
        onClick={() => setRows((prev) => [...prev, emptyRow()])}
        className="mt-2 text-primary hover:text-primary"
      >
        <Plus className="h-4 w-4" /> Add medicine
      </Button>

      {saveError && (
        <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {saveError}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || justSaved}
          // Manoj msg 2085: the button changes to a "Saved" state for
          // 2.5s after a successful write so it's obvious the action
          // landed, then reverts to the normal Save affordance.
          className={
            justSaved ? "bg-success text-success-foreground" : undefined
          }
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving
            </>
          ) : justSaved ? (
            <>
              <Check className="h-4 w-4" /> Saved
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> Save
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => printMutation.mutate("print")}
          disabled={!canPrint || printMutation.isPending}
        >
          <Printer className="h-4 w-4" /> Save & Print Rx
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => printMutation.mutate("download")}
          disabled={!canPrint || printMutation.isPending}
        >
          Download PDF
        </Button>
      </div>
    </div>
  );
}

// Paper-style compact row (Manoj msg 2092). Each medicine is a
// numbered entry with the name on the top line + Qty box, and dosage
// controls flowing across the next line — Dosage chips, Before/After,
// × N days. Note stays as a small trailing input.
function RxRowEditor({
  row,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  row: RxRow;
  index: number;
  canRemove: boolean;
  onChange: (patch: Partial<RxRow>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      {/* Line 1: N. [Medicine name.......]  Qty [__]  🗑 */}
      <div className="flex items-center gap-2">
        <span className="w-6 shrink-0 text-sm font-semibold text-muted-foreground">
          {index + 1}.
        </span>
        <Input
          id={`med-${row.id}`}
          value={row.medicineName}
          onChange={(e) => onChange({ medicineName: e.target.value })}
          placeholder="Medicine name"
          className="h-9 min-w-0 flex-1 text-base"
        />
        <div className="flex shrink-0 items-center gap-1">
          <span className="text-xs text-muted-foreground">Qty</span>
          <Input
            id={`qty-${row.id}`}
            type="number"
            min="0"
            max="1000"
            value={row.quantity}
            onChange={(e) =>
              onChange({
                quantity: e.target.value,
                quantityManuallyEdited: true,
              })
            }
            placeholder={isNonTabletMedicine(row.medicineName) ? "—" : "auto"}
            className="h-9 w-16 text-center text-base"
          />
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
            aria-label="Remove medicine"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Line 2: dosage chips + meal toggle + × N days — wraps on
          narrow screens; sits on one line on tablets and up. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 pl-8">
        <div className="flex flex-wrap gap-1">
          {DOSAGE_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange({ dosage: p, customDosage: false })}
              className={`rounded border px-1.5 py-0.5 font-mono text-xs ${
                row.dosage === p && !row.customDosage
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({
                customDosage: !row.customDosage,
                dosage: row.customDosage ? "" : row.dosage,
              })
            }
            className={`rounded border px-1.5 py-0.5 text-xs ${
              row.customDosage
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            +
          </button>
        </div>
        {(["before", "after"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange({ meal: row.meal === m ? "" : m })}
            className={`rounded border px-2 py-0.5 text-xs ${
              row.meal === m
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            {m === "before" ? "Bfr" : "Aft"}
          </button>
        ))}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>×</span>
          <Input
            id={`dur-${row.id}`}
            type="number"
            min="1"
            max="365"
            value={row.durationValue}
            onChange={(e) => onChange({ durationValue: e.target.value })}
            placeholder="3"
            className="h-7 w-12 text-center text-sm"
          />
          <select
            value={row.durationUnit}
            onChange={(e) =>
              onChange({ durationUnit: e.target.value as DurationUnit })
            }
            className="h-7 rounded border bg-card px-1 text-xs"
          >
            {DURATION_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      {row.customDosage && (
        <div className="mt-1.5 pl-8">
          <Input
            value={row.dosage}
            onChange={(e) => onChange({ dosage: e.target.value })}
            placeholder="Custom dosage e.g. 2-1-2"
            className="h-8 max-w-[12rem] font-mono text-sm"
          />
        </div>
      )}

      {/* Optional note — small trailing input, shown always but small. */}
      <div className="mt-1.5 pl-8">
        <Input
          id={`note-${row.id}`}
          value={row.note}
          onChange={(e) => onChange({ note: e.target.value })}
          placeholder="Note (optional) — e.g. with warm water"
          className="h-8 text-sm text-muted-foreground"
        />
      </div>
    </div>
  );
}

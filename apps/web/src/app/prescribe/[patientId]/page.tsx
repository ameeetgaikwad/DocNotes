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
import { Label } from "@/components/ui/label";

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
  const patientHeader = [
    formatPatientName(patient),
    formatGender(patient.gender),
    age != null ? `${age} y` : null,
    dobDisplay,
  ]
    .filter(Boolean)
    .join(" · ");

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
          Date: <span className="font-medium">{visitDateParam}</span>
        </div>
      </div>

      <div className="mb-6 rounded-xl border bg-card p-4 sm:p-5">
        <h1 className="text-lg font-semibold sm:text-xl">Write Prescription</h1>
        <p className="mt-1 text-sm text-muted-foreground">{patientHeader}</p>
      </div>

      {chips.length > 0 && (
        <div className="mb-4 rounded-xl border border-dashed bg-muted/40 p-3">
          <div className="mb-2 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Frequently used — tap to add
          </div>
          <div className="flex flex-wrap gap-1.5">
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
                className="rounded-full border bg-card px-3 py-1 text-xs hover:bg-accent"
              >
                {c.medicineName}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
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
        variant="outline"
        onClick={() => setRows((prev) => [...prev, emptyRow()])}
        className="mt-4"
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
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">
          Medicine {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Remove medicine"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor={`med-${row.id}`}>Medicine name</Label>
          <Input
            id={`med-${row.id}`}
            value={row.medicineName}
            onChange={(e) => onChange({ medicineName: e.target.value })}
            placeholder="e.g. Triphala Churna"
            className="text-base"
          />
        </div>

        <div className="space-y-1">
          <Label>Dosage</Label>
          <div className="flex flex-wrap gap-1.5">
            {DOSAGE_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onChange({ dosage: p, customDosage: false })}
                className={`rounded-md border px-2.5 py-1 text-xs font-mono ${
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
              className={`rounded-md border px-2.5 py-1 text-xs ${
                row.customDosage
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              + custom
            </button>
          </div>
          {row.customDosage && (
            <Input
              value={row.dosage}
              onChange={(e) => onChange({ dosage: e.target.value })}
              placeholder="e.g. 2-1-2"
              className="mt-1.5 max-w-[10rem] font-mono text-base"
            />
          )}
        </div>

        <div className="space-y-1">
          <Label>Meal</Label>
          <div className="flex gap-2">
            {(["before", "after"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onChange({ meal: row.meal === m ? "" : m })}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  row.meal === m
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {m === "before" ? "Before meals" : "After meals"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor={`dur-${row.id}`}>Duration</Label>
            <div className="flex gap-1.5">
              <Input
                id={`dur-${row.id}`}
                type="number"
                min="1"
                max="365"
                value={row.durationValue}
                onChange={(e) => onChange({ durationValue: e.target.value })}
                placeholder="3"
                className="text-base"
              />
              <select
                value={row.durationUnit}
                onChange={(e) =>
                  onChange({ durationUnit: e.target.value as DurationUnit })
                }
                className="rounded-md border bg-card px-2 py-1 text-sm"
              >
                {DURATION_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`qty-${row.id}`}>Quantity</Label>
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
              placeholder="auto"
              className="text-base"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor={`note-${row.id}`}>Note (optional)</Label>
          <Input
            id={`note-${row.id}`}
            value={row.note}
            onChange={(e) => onChange({ note: e.target.value })}
            placeholder="e.g. With warm water"
            className="text-base"
          />
        </div>
      </div>
    </div>
  );
}

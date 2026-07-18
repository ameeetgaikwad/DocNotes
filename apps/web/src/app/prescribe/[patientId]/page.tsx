"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Loader2,
  MessageCircle,
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
  encodeDurationWithMl,
  isNonTabletMedicine,
  parseDurationWithMl,
  sanitizeFreeText,
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
import { SendToChemistDialog } from "@/components/patients/send-to-chemist-dialog";

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
  // Manoj msg 2112: ml is an alternative to tablet count for liquid
  // meds. Only one per row (tabs OR ml); the editor auto-disables the
  // other input. Persisted inside the `duration` DB column via the
  // shared encode/parseDurationWithMl helpers.
  mlQuantity: string;
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
    mlQuantity: "",
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

// Shared hydration builder — used by both the initial listByVisit
// hydration and the post-save adoptServerLines. Parses the compound
// duration string (which may carry an "· N ml" suffix per Manoj
// msg 2112) and reconstructs the individual editor fields.
function rowFromServerLine(l: {
  id: string;
  medicineName: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  quantity: number | null;
  instructions: string | null;
}): RxRow {
  const isPreset = DOSAGE_PRESETS.includes(
    l.dosage as (typeof DOSAGE_PRESETS)[number],
  );
  // Manoj msg 2080: wipe stale wrong quantities on non-tablet meds
  // that were auto-populated before the syrup-detection fix landed.
  const stalePillCount =
    isNonTabletMedicine(l.medicineName) && (l.quantity ?? 0) > 0;
  const parsed = parseDurationWithMl(l.duration);
  const durationText = parsed.duration ?? "";
  return {
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
    durationValue: durationText ? (durationText.split(" ")[0] ?? "") : "",
    durationUnit: durationText.includes("weeks")
      ? "weeks"
      : durationText.includes("months")
        ? "months"
        : "days",
    quantity: stalePillCount || l.quantity == null ? "" : String(l.quantity),
    quantityManuallyEdited: !stalePillCount,
    mlQuantity: parsed.mlValue != null ? String(parsed.mlValue) : "",
    note: l.instructions ?? "",
  };
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
  // Server ids of rows the doctor removed via the trash icon since
  // the last save (Manoj msg 2244). Passed to the backend on save so
  // it explicitly deletes them — otherwise the removed rows would
  // silently persist in the DB and get re-serialized into notes.
  const [deletedServerIds, setDeletedServerIds] = useState<string[]>([]);
  // Send-to-Chemist dialog visibility (Manoj msg 2267).
  const [chemistDialogOpen, setChemistDialogOpen] = useState(false);
  // Manoj msg 2407: user complaint — tapping a frequently-used chip
  // when the medicine is already in the row list appended a duplicate.
  // We now scroll to the existing row and briefly ring it instead of
  // appending. This state clears after 1.5s.
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
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
      ...existingLinesQuery.data.map((l) => rowFromServerLine(l)),
    ]);
    setHasHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingLinesQuery.data, hasHydrated]);

  function updateRow(id: string, patch: Partial<RxRow>) {
    // Any user edit invalidates the "Saved ✓" state so the Save
    // button flips back to its regular affordance (Manoj msg 2181).
    setJustSaved(false);
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

  // Build the wire payload from the current rows array. Extracted so
  // Save and Save-and-Print share the same shape (including sending
  // r.serverId in the id field — Manoj msg 2098 fix). Without the id,
  // the backend upsert treats every row as new and stacks duplicates.
  function buildPayload() {
    return rows
      .filter((r) => sanitizeFreeText(r.medicineName).trim().length > 0)
      .map((r) => {
        const ml =
          r.mlQuantity.trim() && Number.isFinite(Number(r.mlQuantity))
            ? Number(r.mlQuantity)
            : null;
        return {
          id: r.serverId,
          medicineName: sanitizeFreeText(r.medicineName).trim(),
          dosage: sanitizeFreeText(r.dosage).trim() || null,
          frequency: r.meal || null,
          duration: encodeDurationWithMl(combineDuration(r), ml),
          quantity: r.quantity ? Number(r.quantity) : null,
          instructions: sanitizeFreeText(r.note).trim() || null,
        };
      });
  }

  // Sync rows with the authoritative list the server sent back so newly
  // inserted rows adopt their DB ids. Any typing the doctor started
  // after the save fires would be included in the next save's payload,
  // so replacing the rows with the server view is safe here.
  function adoptServerLines(
    lines: Array<{
      id: string;
      medicineName: string;
      dosage: string | null;
      frequency: string | null;
      duration: string | null;
      quantity: number | null;
      instructions: string | null;
    }>,
  ) {
    if (lines.length === 0) return;
    setRows(lines.map((l) => rowFromServerLine(l)));
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      setSaveError(null);
      const result = await trpcClient.prescriptionLine.upsert.mutate({
        patientId,
        visitDate: visitDateParam,
        lines: buildPayload(),
        deletedIds: deletedServerIds,
      });
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [["patientVisit"]] });
      queryClient.invalidateQueries({ queryKey: [["prescriptionLine"]] });
      // Adopt server ids so the next Save/Print doesn't duplicate.
      if (result.lines) adoptServerLines(result.lines);
      // Delete-tombstones have been applied on the server; clear the
      // client list so a subsequent Save doesn't re-send stale ids.
      setDeletedServerIds([]);
      // Manoj msg 2085: give the Save button visible feedback that the
      // action landed — swap in a "Saved ✓" state. Manoj msg 2181
      // update: hold that state until the doctor edits or adds a row,
      // rather than reverting after 2.5s. The reset happens inside
      // updateRow / Add / Remove handlers below.
      setJustSaved(true);
    },
    onError: (e) => setSaveError(e.message),
  });

  const printMutation = useMutation({
    mutationFn: async (action: "print" | "download") => {
      setSaveError(null);
      // Save first so the PDF picks up the freshest data.
      const saved = await trpcClient.prescriptionLine.upsert.mutate({
        patientId,
        visitDate: visitDateParam,
        lines: buildPayload(),
        deletedIds: deletedServerIds,
      });
      // Adopt server ids so a subsequent Save/Print doesn't duplicate.
      if (saved.lines) adoptServerLines(saved.lines);
      if (!saved.visitId) {
        // Nothing was saved — skip the print. This should only fire if
        // the doctor tapped Save & Print with all rows empty, in which
        // case the disabled state has already gated the button.
        return { action };
      }
      const pdf = await trpcClient.export.prescription.mutate({
        visitId: saved.visitId,
      });
      if (action === "print") {
        printBase64Pdf(pdf.base64);
      } else {
        downloadBase64File(pdf.base64, pdf.filename, "application/pdf");
      }
      return { action };
    },
    onSuccess: () => {
      // Delete-tombstones applied — clear so we don't re-send on next save.
      setDeletedServerIds([]);
      // Save-then-print counts as a save; light up the Saved ✓ state
      // the same way plain Save does (Manoj msg 2181).
      setJustSaved(true);
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
              onClick={() => {
                setJustSaved(false);
                // Manoj msg 2407: dedup — if this medicine is already
                // on the list (whether the doctor typed it or it was
                // hydrated from an earlier same-day Rx), scroll to that
                // row and ring it briefly instead of appending. Kills
                // the "why is Telsar beta showing twice?" class of bug.
                const existing = rows.find(
                  (r) =>
                    r.medicineName.trim().toLowerCase() ===
                    c.medicineName.toLowerCase(),
                );
                if (existing) {
                  setHighlightedRowId(existing.id);
                  document
                    .getElementById(`rx-row-${existing.id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                  window.setTimeout(() => setHighlightedRowId(null), 1500);
                  return;
                }
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
                });
              }}
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
            highlighted={highlightedRowId === row.id}
            onChange={(patch) => updateRow(row.id, patch)}
            onRemove={() => {
              setJustSaved(false);
              // If this row was hydrated from the server, tombstone
              // its id so the next save tells the backend to delete
              // it (Manoj msg 2244 delete-gap fix). Client-only rows
              // never touched the DB, so no tombstone needed.
              if (row.serverId) {
                setDeletedServerIds((prev) => [...prev, row.serverId!]);
              }
              setRows((prev) => prev.filter((r) => r.id !== row.id));
            }}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          setJustSaved(false);
          setRows((prev) => [...prev, emptyRow()]);
        }}
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
          // Manoj msg 2192: the earlier bg-success class rendered as a
          // dark green, indistinguishable from the primary teal. Swap
          // for a pale green pill so the "Saved ✓" state is obviously
          // different — dark green text on a very light green field.
          className={
            justSaved
              ? "border-emerald-300 bg-emerald-100 text-emerald-900 hover:bg-emerald-100 hover:text-emerald-900"
              : undefined
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
          {printMutation.isPending && printMutation.variables === "print" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Preparing
            </>
          ) : (
            <>
              <Printer className="h-4 w-4" /> Save & Print Rx
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => printMutation.mutate("download")}
          disabled={!canPrint || printMutation.isPending}
        >
          {printMutation.isPending && printMutation.variables === "download" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Preparing
            </>
          ) : (
            <>Download PDF</>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setChemistDialogOpen(true)}
          disabled={!canPrint}
        >
          <MessageCircle className="h-4 w-4" /> Send to Chemist
        </Button>
      </div>

      <SendToChemistDialog
        open={chemistDialogOpen}
        onOpenChange={setChemistDialogOpen}
        patient={{
          firstName: patient.firstName,
          middleName: patient.middleName,
          lastName: patient.lastName,
          gender: patient.gender,
          dateOfBirth: patient.dateOfBirth,
          dobYear: patient.dobYear,
        }}
        visitDate={visitDateParam}
        lines={buildPayload().map((l) => ({
          medicineName: l.medicineName,
          dosage: l.dosage,
          frequency: l.frequency,
          duration: l.duration,
          quantity: l.quantity,
          instructions: l.instructions,
        }))}
      />
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
  highlighted,
  onChange,
  onRemove,
}: {
  row: RxRow;
  index: number;
  canRemove: boolean;
  highlighted: boolean;
  onChange: (patch: Partial<RxRow>) => void;
  onRemove: () => void;
}) {
  return (
    <div
      id={`rx-row-${row.id}`}
      className={`rounded-lg border bg-card p-3 transition-shadow ${
        highlighted ? "ring-2 ring-primary/60 shadow-md" : ""
      }`}
    >
      {/* Line 1: N. [Medicine name.......]  [Qty]  [ml]  🗑
          Manoj msg 2175 (v3): both Qty and ml always stay editable.
          The earlier mutual-disable behaviour blocked liquid Rx like
          "1 bottle · 120 ml" where the doctor legitimately wants
          both. Placeholder inside each box does the labelling now —
          the standalone label span was redundant with the placeholder
          (msg 2175 point 3). */}
      <div className="flex items-center gap-2">
        <span className="w-6 shrink-0 text-sm font-semibold text-muted-foreground">
          {index + 1}.
        </span>
        <Input
          id={`med-${row.id}`}
          value={row.medicineName}
          // Sanitize on every keystroke (Manoj msg 2200). Some Android
          // IMEs inject Cf format chars (RLO / ALM) as the user types,
          // which flips the input's visible rendering right-to-left
          // and makes it look like nothing was typed. Stripping the
          // noise before it hits state fixes both the typing UX and
          // the downstream save.
          onChange={(e) =>
            onChange({ medicineName: sanitizeFreeText(e.target.value) })
          }
          placeholder="Medicine name"
          className="h-9 min-w-0 flex-1 text-base"
        />
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
          placeholder="Qty"
          className="h-9 w-14 shrink-0 text-center text-base"
        />
        <Input
          id={`ml-${row.id}`}
          type="number"
          min="0"
          max="2000"
          value={row.mlQuantity}
          onChange={(e) => onChange({ mlQuantity: e.target.value })}
          placeholder="ml"
          className="h-9 w-14 shrink-0 text-center text-base"
          aria-label="ml"
        />
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

"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Loader2,
  AlertCircle,
  BookOpen,
  Save,
  Pill,
  Archive,
} from "lucide-react";
import { trpc, trpcClient } from "@/lib/trpc";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HomeopathicMedicinePicker } from "@/components/patients/homeopathic-medicine-picker";
import { MedicineAutocompleteTextarea } from "@/components/patients/medicine-autocomplete-textarea";

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
  spO2Percent: number | null;
  clinicalNotes: string | null;
};

export function PatientHistory({ patientId }: PatientHistoryProps) {
  const { data, isLoading, error } = useQuery(
    trpc.patientVisit.listByPatient.queryOptions({ patientId }),
  );
  // Legacy medical_records (pre patient_visits rewrite). Render them
  // read-only below the new timeline so existing data isn't hidden.
  // Empty list is fine — section is suppressed when there are none.
  const legacy = useQuery(
    trpc.medicalRecord.listByPatient.queryOptions({
      patientId,
      limit: 100,
      page: 1,
    }),
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

  const visits = data ?? [];
  const legacyRecords = legacy.data?.items ?? [];

  if (visits.length === 0 && legacyRecords.length === 0) {
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
      {visits.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            {visits.length} visit{visits.length !== 1 && "s"}
          </p>
          {visits.map((visit, index) => (
            <VisitCard
              key={visit.id}
              visit={visit}
              isLatest={index === 0}
              patientId={patientId}
            />
          ))}
        </>
      )}

      {legacyRecords.length > 0 && (
        <LegacyMedicalRecords records={legacyRecords} />
      )}
    </div>
  );
}

type LegacyRecord = {
  id: string;
  title: string;
  type: string;
  createdAt: Date | string;
  content: unknown;
  vitals: unknown;
  diagnoses: unknown;
};

function LegacyMedicalRecords({ records }: { records: LegacyRecord[] }) {
  return (
    <section className="space-y-3 pt-4">
      <div className="flex items-center gap-2 border-t pt-4">
        <Archive className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-muted-foreground">
          Older notes ({records.length})
        </h3>
      </div>
      <p className="text-xs text-muted-foreground">
        These are saved before the new visit timeline. Read-only — for
        reference.
      </p>
      <div className="space-y-3">
        {records.map((r) => (
          <LegacyRecordCard key={r.id} record={r} />
        ))}
      </div>
    </section>
  );
}

function LegacyRecordCard({ record }: { record: LegacyRecord }) {
  const content = (record.content ?? {}) as {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  const vitals = (record.vitals ?? {}) as Record<string, number | string>;
  const diagnoses = (record.diagnoses ?? []) as string[];
  const vitalsEntries = Object.entries(vitals).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );
  return (
    <div className="space-y-2 rounded-xl border bg-muted/30 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{record.title}</p>
          <p className="text-xs text-muted-foreground">
            {record.type} · {formatDate(record.createdAt)}
          </p>
        </div>
      </div>
      {vitalsEntries.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {vitalsEntries.map(([k, v]) => `${k}: ${v}`).join(" · ")}
        </p>
      )}
      {diagnoses.length > 0 && (
        <p className="text-xs">
          <span className="text-muted-foreground">Diagnoses: </span>
          {diagnoses.join(", ")}
        </p>
      )}
      {(content.subjective ||
        content.objective ||
        content.assessment ||
        content.plan) && (
        <div className="space-y-1 text-sm">
          {content.subjective && (
            <p>
              <span className="font-medium">S: </span>
              {content.subjective}
            </p>
          )}
          {content.objective && (
            <p>
              <span className="font-medium">O: </span>
              {content.objective}
            </p>
          )}
          {content.assessment && (
            <p>
              <span className="font-medium">A: </span>
              {content.assessment}
            </p>
          )}
          {content.plan && (
            <p>
              <span className="font-medium">P: </span>
              {content.plan}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const FOLLOWUP_WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fortyfive: 45,
  sixty: 60,
};

/**
 * Best-effort parser for follow-up phrases inside a clinical-notes
 * blob. Looks for "after <N> <unit> !" — the trailing "!" is the
 * explicit signal that the doctor wants a follow-up reminder created
 * (Manoj msg 885 — eliminates the ambiguity of past-tense phrasing
 * like "patient came after 2 days" without needing fancy heuristics).
 *
 * Both digits and common word-numbers (one … twelve, fifteen, twenty,
 * thirty, forty, forty-five, sixty) match. Returns the matched phrase
 * + the computed target date relative to `from`, or null otherwise.
 *
 * Examples that match (case-insensitive):
 *   "Inj B12 repeat after 1 month!"
 *   "Inj D3 after one month !"
 *   "Follow-up after 2 weeks !"
 *   "Review in 10 days!"
 */
function detectFollowUp(
  notes: string,
  from: Date,
): { matchText: string; date: Date; unitCount: number; unit: string } | null {
  if (!notes || !notes.trim()) return null;
  const wordPattern = Object.keys(FOLLOWUP_WORD_NUMBERS).join("|");
  const re = new RegExp(
    `(?:after|in)\\s+(\\d{1,3}|${wordPattern})\\s+(day|week|month|year)s?\\s*!`,
    "i",
  );
  const m = re.exec(notes);
  if (!m) return null;
  const countStr = (m[1] ?? "").toLowerCase();
  const count = FOLLOWUP_WORD_NUMBERS[countStr] ?? Number(countStr);
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
  const [form, setForm] = useState<VisitFormState>(initial);
  // Tracks the most recently saved snapshot so the Save/Discard
  // buttons disappear instantly on save success — without this the
  // `initial` derived from `visit` is stale (the React Query refetch
  // hasn't arrived yet) and `dirty` stays true for the duration of
  // the network roundtrip (Manoj msg 1573). Resets on visit change.
  const [lastSaved, setLastSaved] = useState<VisitFormState>(initial);
  // Inline-autocomplete corpus for the clinical-notes textarea (Manoj
  // msg 972 → 976). Pulled once per session — tanstack-query caches
  // the result across all VisitCard instances on the page.
  const hintsQuery = useQuery({
    ...trpc.patientVisit.medicineHints.queryOptions(),
    staleTime: 60_000,
  });
  const medicineHints = hintsQuery.data ?? [];
  // editAll = true means all fields are visible (empty included) AND the
  // Save / Discard buttons are usable. Default behaviour (Manoj msg
  // 1550): only show fields that already have values, regardless of
  // whether this is the latest visit. The single exception is a
  // brand-new latest visit with NO content at all — there we still
  // default to edit mode so the doctor can fill in today's data without
  // hunting for "Edit fields". Once anything is saved, the read-only
  // view kicks in and empty vitals stay hidden until the doctor opts in.
  const isVisitEmpty =
    visit.bpSystolic === null &&
    visit.bpDiastolic === null &&
    visit.heartRate === null &&
    visit.spO2Percent === null &&
    !visit.bslFasting &&
    !visit.bslPostprandial &&
    !visit.bslRandom &&
    !visit.temperatureCelsius &&
    !visit.weightKg &&
    !visit.heightCm &&
    !visit.clinicalNotes;
  const [editAll, setEditAll] = useState(isLatest && isVisitEmpty);
  const [pickerOpen, setPickerOpen] = useState(false);
  // F/U inline form state — Manoj msg 1387. Replaces the non-functional
  // Rx button. Tapping F/U opens a small popover with a days input and an
  // optional 25-char reason. On Insert we append "Follow up after N days!
  // <reason>" to the clinical notes; the existing detectFollowUp parser
  // on save picks that up and schedules the appointment.
  const [fuOpen, setFuOpen] = useState(false);
  const [fuDays, setFuDays] = useState("");
  const [fuReason, setFuReason] = useState("");
  const [followUpToast, setFollowUpToast] = useState<{
    text: string;
    when: string;
    appointmentId: string;
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
    const next = visitToForm(visit);
    setForm(next);
    setLastSaved(next);
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
      // If the same match phrase was already in the previously-saved
      // notes, the appointment for it was created on the prior save —
      // re-saving the visit (e.g., to correct vitals) must NOT spawn a
      // duplicate. Compare against visit.clinicalNotes (the pre-edit
      // state) and skip when the trigger phrase is unchanged.
      const priorFollowUp = detectFollowUp(
        visit.clinicalNotes ?? "",
        new Date(visit.visitDate),
      );
      const isNewTrigger =
        followUp &&
        (!priorFollowUp ||
          priorFollowUp.matchText.toLowerCase() !==
            followUp.matchText.toLowerCase());

      // If the doctor changed the follow-up phrase ("after 2 weeks!" →
      // "after 3 weeks!"), cancel the previously auto-created appointment
      // before scheduling the new one — otherwise the patient ends up
      // with both reminders (Amit review msg 1097 P2). We identify the
      // prior auto-create by (patient + type=follow_up + reason matching
      // the old phrase + scheduled within a day of the old date), and
      // only cancel those still in "scheduled" state so we don't undo
      // anything the doctor manually updated since.
      if (isNewTrigger && priorFollowUp) {
        try {
          const fromTs = new Date(priorFollowUp.date.getTime() - 86_400_000);
          const toTs = new Date(priorFollowUp.date.getTime() + 86_400_000);
          const existing = await trpcClient.appointment.list.query({
            patientId,
            status: "scheduled",
            from: fromTs,
            to: toTs,
            page: 1,
            limit: 20,
          });
          const target = existing.items.find(
            (a) =>
              a.type === "follow_up" &&
              (a.reason ?? "").trim().toLowerCase() ===
                priorFollowUp.matchText.trim().toLowerCase(),
          );
          if (target) {
            await trpcClient.appointment.cancel.mutate({ id: target.id });
          }
        } catch {
          // Best-effort — if the lookup or cancel fails we still proceed
          // to create the new appointment. Worst case is a duplicate,
          // which is at least as good as the pre-fix behaviour.
        }
      }

      if (followUp && isNewTrigger) {
        try {
          const created = await trpcClient.appointment.create.mutate({
            patientId,
            type: "follow_up",
            scheduledAt: followUp.date,
            durationMinutes: 15,
            reason: followUp.matchText,
            notes: null,
          });
          return {
            followUp: created
              ? { ...followUp, appointmentId: created.id }
              : null,
          };
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
      // Snapshot the just-saved form as the new "last saved" state so
      // dirty flips to false instantly — the React Query refetch
      // hasn't replaced `visit` yet, so relying on `initial` would
      // leave the Save button on screen during the network roundtrip
      // (Manoj msg 1573).
      setLastSaved(form);
      if (result.followUp) {
        const f = result.followUp;
        setFollowUpToast({
          text: f.matchText,
          when: f.date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
          appointmentId: f.appointmentId,
        });
        // No auto-dismiss — the doctor needs the Undo button to stay
        // around until they're confident the parse was correct.
      }
    },
  });

  const undoFollowUp = useMutation({
    mutationFn: (appointmentId: string) =>
      trpcClient.appointment.cancel.mutate({ id: appointmentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["appointment"]] });
      setFollowUpToast(null);
    },
  });

  const dirty = !sameForm(form, lastSaved);
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
  const showSpO2 = showAllFields || form.spO2Percent !== "";
  const showVitalsRow1 = showBp || showHr || showSpO2;
  const showVitalsRow2 = showBslF || showBslPp || showBslR;
  const showVitalsRow3 = showTemp || showWt || showHt;
  const showNotes = showAllFields || form.clinicalNotes !== "";

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
      {/* Sticky header keeps Save / Discard reachable while editing on
          mobile — without this the on-screen keyboard covers the
          bottom-of-card buttons (Manoj msg 1557). bg-card + z-10 stop
          the textarea content from showing through during scroll. */}
      <div className="sticky top-0 z-10 -mx-4 -mt-4 flex items-center justify-between gap-2 border-b bg-card px-4 py-3 sm:-mx-6 sm:-mt-6 sm:px-6">
        <h3 className="text-base font-semibold md:text-lg">
          {formatDate(visit.visitDate)}
        </h3>
        <div className="flex items-center gap-2">
          {/* Manoj msg 1567: Save / Discard show whenever the form is
              dirty, not just when editAll is on. The Clinical Notes
              textarea stays editable in read-only mode (only the empty
              vitals are hidden), so a doctor who just types a quick
              note still needs Save reachable without first tapping
              "Edit fields". */}
          {/* Manoj msg 1759: Save on the left, Discard on the right —
              swap from the previous layout. */}
          {dirty && (
            <Button
              type="button"
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" /> Save
                </>
              )}
            </Button>
          )}
          {dirty && !saveMutation.isPending && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setForm(lastSaved)}
            >
              Discard
            </Button>
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
                    maxLength={3}
                  />
                  <span className="text-muted-foreground">/</span>
                  <NumInput
                    value={form.bpDiastolic}
                    onChange={(v) => setForm({ ...form, bpDiastolic: v })}
                    placeholder="—"
                    className="w-16"
                    maxLength={3}
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
            {showSpO2 && (
              <FieldGroup label="SpO2 (%)" htmlFor={`${visit.id}-spo2`}>
                <NumInput
                  id={`${visit.id}-spo2`}
                  value={form.spO2Percent}
                  onChange={(v) => setForm({ ...form, spO2Percent: v })}
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
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPickerOpen(true)}
                  className="h-7 px-2 text-xs"
                  title="Insert medicine"
                >
                  <Pill className="h-3.5 w-3.5" />M
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFuDays("");
                    setFuReason("");
                    setFuOpen((v) => !v);
                  }}
                  className="h-7 px-2 text-xs"
                  title="Insert a follow-up reminder"
                >
                  F/U
                </Button>
              </div>
            </div>
            {fuOpen && (
              <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-3">
                <p className="text-xs font-medium text-primary">
                  Insert follow-up reminder
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm">Follow up after</span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    value={fuDays}
                    onChange={(e) =>
                      setFuDays(e.target.value.replace(/\D/g, "").slice(0, 3))
                    }
                    placeholder="N"
                    maxLength={3}
                    className="h-8 w-16 text-center"
                  />
                  <span className="text-sm">days!</span>
                  <Input
                    type="text"
                    value={fuReason}
                    onChange={(e) => setFuReason(e.target.value.slice(0, 25))}
                    placeholder="reason (optional, max 25)"
                    maxLength={25}
                    className="h-8 min-w-[10rem] flex-1 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={!fuDays}
                    onClick={() => {
                      const reason = fuReason.trim();
                      // Trailing "!" inside the braces is what
                      // detectFollowUp keys on to schedule the
                      // appointment; the optional reason rides as the
                      // appointment's reason text. Braces (Manoj msg
                      // 1999) visually fence the follow-up off from
                      // the rest of the clinical notes; the regex
                      // doesn't anchor to braces so older un-braced
                      // lines still parse.
                      const line = reason
                        ? `{Follow up after ${fuDays} days! ${reason}}`
                        : `{Follow up after ${fuDays} days!}`;
                      setForm((prev) => {
                        const current = prev.clinicalNotes;
                        const next =
                          current.length === 0
                            ? line
                            : current.endsWith("\n")
                              ? current + line
                              : current + "\n" + line;
                        return { ...prev, clinicalNotes: next };
                      });
                      setFuOpen(false);
                    }}
                  >
                    Insert
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setFuOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  The reminder will be created automatically when you save the
                  visit.
                </p>
              </div>
            )}
            <MedicineAutocompleteTextarea
              id={`${visit.id}-notes`}
              rows={6}
              maxLength={20000}
              placeholder="Symptoms, examination findings, plan, medications, advice…"
              value={form.clinicalNotes}
              onChange={(next) =>
                setForm((prev) => ({ ...prev, clinicalNotes: next }))
              }
              hints={medicineHints}
              className="md:min-h-[10rem] md:text-base"
            />
            {/* Save / Discard moved to the sticky header above so the
                keyboard never covers them. Bottom-of-card spacing kept
                for breathing room. */}
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
        <div className="flex items-start justify-between gap-3 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-700/50 dark:bg-emerald-950/30">
          <div className="flex-1">
            <p className="font-medium text-emerald-900 dark:text-emerald-200">
              Follow-up reminder created for {followUpToast.when}
            </p>
            <p className="mt-0.5 text-xs text-emerald-800 dark:text-emerald-300">
              Picked up &ldquo;{followUpToast.text}&rdquo; from your notes. Tap
              Done to confirm or Undo if this wasn&apos;t meant as a follow-up.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => undoFollowUp.mutate(followUpToast.appointmentId)}
              disabled={undoFollowUp.isPending}
            >
              {undoFollowUp.isPending ? "Undoing…" : "Undo"}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setFollowUpToast(null)}
              disabled={undoFollowUp.isPending}
            >
              Done
            </Button>
          </div>
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
  maxLength,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  maxLength?: number;
}) {
  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      value={value}
      onChange={(e) => {
        const sanitized = sanitizeDecimal(e.target.value);
        onChange(maxLength != null ? sanitized.slice(0, maxLength) : sanitized);
      }}
      maxLength={maxLength}
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
  spO2Percent: string;
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
    spO2Percent: v.spO2Percent != null ? String(v.spO2Percent) : "",
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
    a.spO2Percent === b.spO2Percent &&
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
    spO2Percent: toIntOrNull(f.spO2Percent),
    clinicalNotes: emptyToNull(f.clinicalNotes),
  };
}

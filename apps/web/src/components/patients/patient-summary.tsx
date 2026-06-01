"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { trpc, trpcClient } from "@/lib/trpc";
import { formatPatientName } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface PatientData {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  bloodType: string | null;
  allergies: unknown;
  allergyNotes: string | null;
  activeConditions: unknown;
  conditionNotes: string | null;
  notes: string | null;
  responsiblePartyName: string | null;
  createdAt: Date;
}

interface PatientSummaryProps {
  patient: PatientData;
}

type Allergy = {
  name: string;
  severity: string;
  reaction?: string;
};

export function PatientSummary({ patient }: PatientSummaryProps) {
  const allergies = (patient.allergies ?? []) as Allergy[];
  const conditions = (patient.activeConditions ?? []) as string[];
  // Previously-used Responsible Party labels — first source for the
  // autocomplete (Manoj msg 1095 #4).
  const rpNamesQuery = useQuery({
    ...trpc.patient.responsiblePartyNames.queryOptions(),
    staleTime: 30_000,
  });
  // Patient-list query so the RP dropdown can suggest existing patients
  // by name (Manoj msg 1398 #2). Limit clamped to the patientSearchSchema
  // max of 100 — Amit msg 1404 caught the prior limit:500 returning a
  // tRPC validation error which left the suggestions silently empty.
  // The previously-used RP labels (rpNamesQuery, no limit) cover the
  // common-case payers; the 100 most-recent patients here cover the
  // long tail. A clinic with >100 patients can still type the full
  // name to save it as a free-text RP label; that label then flows
  // into future suggestions via rpNamesQuery.
  const allPatientsQuery = useQuery({
    ...trpc.patient.list.queryOptions({ page: 1, limit: 100 }),
    staleTime: 60_000,
  });
  const rpSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const name of rpNamesQuery.data ?? []) set.add(name);
    for (const p of allPatientsQuery.data?.items ?? []) {
      const name = formatPatientName(p);
      // A patient can't be their own Responsible Party.
      if (name && p.id !== patient.id) set.add(name);
    }
    return Array.from(set);
  }, [rpNamesQuery.data, allPatientsQuery.data, patient.id]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Allergies{allergies.length > 0 && ` (${allergies.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {allergies.length > 0 && (
            <div className="space-y-2">
              {allergies.map((allergy) => (
                <div
                  key={allergy.name}
                  className="flex items-center justify-between"
                >
                  <div>
                    <span className="text-sm font-medium">{allergy.name}</span>
                    {allergy.reaction && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        — {allergy.reaction}
                      </span>
                    )}
                  </div>
                  <Badge
                    variant={
                      allergy.severity === "severe"
                        ? "destructive"
                        : allergy.severity === "moderate"
                          ? "warning"
                          : "secondary"
                    }
                  >
                    {allergy.severity}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          <NotesEditor
            patientId={patient.id}
            field="allergyNotes"
            initial={patient.allergyNotes ?? ""}
            placeholder="Notes about allergies — sensitivities, observed reactions, history…"
            textClassName="font-semibold text-red-700 dark:text-red-300"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Active Conditions
            {conditions.length > 0 && ` (${conditions.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {conditions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {conditions.map((condition) => (
                <Badge key={condition} variant="outline">
                  {condition}
                </Badge>
              ))}
            </div>
          )}
          <NotesEditor
            patientId={patient.id}
            field="conditionNotes"
            initial={patient.conditionNotes ?? ""}
            placeholder="Notes about active conditions — onset, severity, treatments tried…"
          />
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Contact &amp; details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <PhoneEditor patientId={patient.id} initial={patient.phone ?? ""} />
          <FieldEditor
            patientId={patient.id}
            field="email"
            label="Email"
            initial={patient.email ?? ""}
            type="email"
            placeholder="name@example.com"
          />
          <FieldEditor
            patientId={patient.id}
            field="address"
            label="Address"
            initial={patient.address ?? ""}
            multiline
            maxLength={75}
          />
          <FieldEditor
            patientId={patient.id}
            field="emergencyContactName"
            label="Emergency contact"
            initial={patient.emergencyContactName ?? ""}
            placeholder="Name"
          />
          <FieldEditor
            patientId={patient.id}
            field="emergencyContactPhone"
            label="Emergency phone"
            initial={patient.emergencyContactPhone ?? ""}
            type="tel"
            placeholder="+91 98765 43210"
          />
          <FieldEditor
            patientId={patient.id}
            field="responsiblePartyName"
            label="Responsible party"
            initial={patient.responsiblePartyName ?? ""}
            maxLength={255}
            suggestions={rpSuggestions}
            helpText="Any pending dues of this patient will be billed to the Responsible Party entered here."
          />
          <FieldEditor
            patientId={patient.id}
            field="notes"
            label="Notes"
            initial={patient.notes ?? ""}
            multiline
            placeholder="Anything else worth remembering about this patient…"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function FieldEditor({
  patientId,
  field,
  label,
  initial,
  placeholder,
  type,
  multiline,
  maxLength,
  suggestions,
  helpText,
}: {
  patientId: string;
  field:
    | "email"
    | "address"
    | "emergencyContactName"
    | "emergencyContactPhone"
    | "responsiblePartyName"
    | "notes";
  label: string;
  initial: string;
  placeholder?: string;
  type?: "email" | "tel";
  multiline?: boolean;
  maxLength?: number;
  suggestions?: ReadonlyArray<string>;
  helpText?: string;
}) {
  const [focused, setFocused] = useState(false);
  const queryClient = useQueryClient();
  const [value, setValue] = useState(initial);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  const save = useMutation({
    mutationFn: () =>
      trpcClient.patient.update.mutate({
        id: patientId,
        data: { [field]: value.trim() || null },
      }),
    onSuccess: () => {
      setServerError(null);
      queryClient.invalidateQueries({ queryKey: [["patient"]] });
    },
    onError: (err) => setServerError(err.message),
  });

  const dirty = initial !== value;
  const inputId = `patient-${field}`;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
      <label
        htmlFor={inputId}
        className="text-sm text-muted-foreground sm:w-32 sm:shrink-0 sm:pt-2"
      >
        {label}
      </label>
      <div className="flex flex-1 items-start gap-2">
        {multiline ? (
          <Textarea
            id={inputId}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            rows={2}
            maxLength={maxLength ?? 5000}
            className="flex-1 text-sm"
          />
        ) : suggestions && suggestions.length > 0 ? (
          <SuggestInput
            id={inputId}
            type={type ?? "text"}
            inputMode={type === "tel" ? "tel" : undefined}
            autoComplete={type ?? "off"}
            value={value}
            onChange={setValue}
            placeholder={placeholder}
            maxLength={maxLength}
            suggestions={suggestions}
            focused={focused}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
        ) : (
          <Input
            id={inputId}
            type={type ?? "text"}
            inputMode={type === "tel" ? "tel" : undefined}
            autoComplete={type ?? "off"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            className="flex-1"
          />
        )}
        {dirty && (
          <Button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            size="sm"
            variant="outline"
          >
            {save.isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Saving
              </>
            ) : (
              <>
                <Save className="h-3 w-3" /> Save
              </>
            )}
          </Button>
        )}
      </div>
      {helpText && (
        <p className="text-xs text-muted-foreground sm:basis-full sm:pl-32">
          {helpText}
        </p>
      )}
      {serverError && (
        <p className="text-xs text-destructive sm:basis-full sm:pl-32">
          {serverError}
        </p>
      )}
    </div>
  );
}

// Native <datalist> support is patchy on mobile browsers (Samsung
// Internet, some Android Chrome builds), so this is a hand-rolled
// suggestion popover that works the same across phones and desktops.
// Filters case-insensitively, ranks startsWith above contains.
function SuggestInput({
  id,
  type,
  inputMode,
  autoComplete,
  value,
  onChange,
  placeholder,
  maxLength,
  suggestions,
  focused,
  onFocus,
  onBlur,
}: {
  id: string;
  type: string;
  inputMode?: "tel" | undefined;
  autoComplete: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  maxLength?: number;
  suggestions: ReadonlyArray<string>;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const matches = (() => {
    const q = value.trim().toLowerCase();
    const exact = q && suggestions.some((s) => s.toLowerCase() === q);
    if (exact) return [];
    const starts: string[] = [];
    const contains: string[] = [];
    for (const s of suggestions) {
      const lower = s.toLowerCase();
      if (q.length === 0) {
        starts.push(s);
      } else if (lower.startsWith(q)) {
        starts.push(s);
      } else if (lower.includes(q)) {
        contains.push(s);
      }
    }
    return [...starts, ...contains].slice(0, 8);
  })();
  const open = focused && matches.length > 0;

  return (
    <div className="relative flex-1">
      <Input
        id={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        onFocus={onFocus}
        // Delay blur so a click on a suggestion fires before the
        // popover unmounts.
        onBlur={() => setTimeout(onBlur, 120)}
      />
      {open && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-md border bg-popover shadow-md">
          {matches.map((s) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onChange(s)}
                className={cn(
                  "block w-full px-3 py-2 text-left text-sm transition hover:bg-accent",
                )}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PhoneEditor({
  patientId,
  initial,
}: {
  patientId: string;
  initial: string;
}) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(initial);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  const save = useMutation({
    mutationFn: () =>
      trpcClient.patient.update.mutate({
        id: patientId,
        data: { phone: value.trim() || null },
      }),
    onSuccess: () => {
      setServerError(null);
      queryClient.invalidateQueries({ queryKey: [["patient"]] });
    },
    onError: (err) => setServerError(err.message),
  });

  const dirty = initial !== value;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <label
        htmlFor="patient-mobile"
        className="text-sm text-muted-foreground sm:w-32 sm:shrink-0"
      >
        Mobile Number
      </label>
      <div className="flex flex-1 items-center gap-2">
        <Input
          id="patient-mobile"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="+91 98765 43210"
          className="flex-1"
        />
        {dirty && (
          <Button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            size="sm"
            variant="outline"
          >
            {save.isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Saving
              </>
            ) : (
              <>
                <Save className="h-3 w-3" /> Save
              </>
            )}
          </Button>
        )}
      </div>
      {serverError && (
        <p className="text-xs text-destructive sm:basis-full sm:pl-32">
          {serverError}
        </p>
      )}
    </div>
  );
}

function NotesEditor({
  patientId,
  field,
  initial,
  placeholder,
  textClassName,
}: {
  patientId: string;
  field: "allergyNotes" | "conditionNotes";
  initial: string;
  placeholder: string;
  textClassName?: string;
}) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(initial);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  const save = useMutation({
    mutationFn: () =>
      trpcClient.patient.update.mutate({
        id: patientId,
        data: { [field]: value.trim() || null },
      }),
    onSuccess: () => {
      setServerError(null);
      queryClient.invalidateQueries({ queryKey: [["patient"]] });
    },
    onError: (err) => setServerError(err.message),
  });

  const dirty = initial !== value;

  return (
    <div className="space-y-2 border-t pt-3">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        placeholder={placeholder}
        maxLength={5000}
        className={`text-sm ${textClassName ?? ""}`}
      />
      {serverError && <p className="text-xs text-destructive">{serverError}</p>}
      {dirty && (
        <div className="flex items-center justify-end gap-3">
          <span className="text-xs text-muted-foreground">Unsaved</span>
          <Button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            size="sm"
            variant="outline"
          >
            {save.isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Saving
              </>
            ) : (
              <>
                <Save className="h-3 w-3" /> Save
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

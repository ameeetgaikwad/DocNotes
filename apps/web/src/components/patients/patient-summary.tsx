"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { trpcClient } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
}: {
  patientId: string;
  field:
    | "email"
    | "address"
    | "emergencyContactName"
    | "emergencyContactPhone"
    | "notes";
  label: string;
  initial: string;
  placeholder?: string;
  type?: "email" | "tel";
  multiline?: boolean;
  maxLength?: number;
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
      {serverError && (
        <p className="text-xs text-destructive sm:basis-full sm:pl-32">
          {serverError}
        </p>
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

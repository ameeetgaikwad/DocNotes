"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { trpcClient } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
            Allergies ({allergies.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {allergies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No known allergies recorded
            </p>
          ) : (
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
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Active Conditions ({conditions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {conditions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active conditions recorded
            </p>
          ) : (
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
        <CardContent className="flex items-center justify-between py-4">
          <span className="text-sm text-muted-foreground">Mobile Number</span>
          <span className="text-sm font-medium">
            {patient.phone || "Not provided"}
          </span>
        </CardContent>
      </Card>
    </div>
  );
}

function NotesEditor({
  patientId,
  field,
  initial,
  placeholder,
}: {
  patientId: string;
  field: "allergyNotes" | "conditionNotes";
  initial: string;
  placeholder: string;
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
        className="text-sm"
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

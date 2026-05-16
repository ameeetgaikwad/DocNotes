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
  activeConditions: unknown;
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
  const queryClient = useQueryClient();
  const allergies = (patient.allergies ?? []) as Allergy[];
  const conditions = (patient.activeConditions ?? []) as string[];

  const [notes, setNotes] = useState(patient.notes ?? "");
  useEffect(() => {
    setNotes(patient.notes ?? "");
  }, [patient.notes]);

  const saveNotes = useMutation({
    mutationFn: () =>
      trpcClient.patient.update.mutate({
        id: patient.id,
        data: { notes: notes.trim() || null },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["patient"]] });
    },
  });

  const notesDirty = (patient.notes ?? "") !== notes;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Allergies ({allergies.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Active Conditions ({conditions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Notes</CardTitle>
            {notesDirty && !saveNotes.isPending && (
              <span className="text-xs text-muted-foreground">
                Unsaved changes
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Free-form notes about allergies, conditions, or anything else relevant for this patient."
            maxLength={5000}
          />
          {saveNotes.error && (
            <p className="text-xs text-destructive">
              {saveNotes.error.message}
            </p>
          )}
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => saveNotes.mutate()}
              disabled={!notesDirty || saveNotes.isPending}
              size="sm"
            >
              {saveNotes.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" /> Save Notes
                </>
              )}
            </Button>
          </div>
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

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, FileText, Plus, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VisitNoteEditor } from "@/components/patients/visit-note-editor";

interface PatientHistoryProps {
  patientId: string;
}

const recordTypeLabels: Record<string, string> = {
  visit_note: "Visit Note",
  lab_result: "Lab Result",
  prescription: "Prescription",
  referral: "Referral",
  procedure: "Procedure",
  imaging: "Imaging",
  document: "Document",
};

const recordTypeVariants: Record<
  string,
  "default" | "secondary" | "outline" | "success" | "warning" | "destructive"
> = {
  visit_note: "default",
  lab_result: "secondary",
  prescription: "success",
  referral: "outline",
  procedure: "warning",
  imaging: "secondary",
  document: "outline",
};

export function PatientHistory({ patientId }: PatientHistoryProps) {
  const [page, setPage] = useState(1);
  const [editorOpen, setEditorOpen] = useState(false);

  const { data, isLoading, error } = useQuery(
    trpc.medicalRecord.listByPatient.queryOptions({
      patientId,
      page,
      limit: 20,
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
          <p className="font-medium">Failed to load medical records</p>
          <p className="text-sm">
            {error.message.includes("UNAUTHORIZED")
              ? "Please sign in to view records"
              : "Check your connection and try again"}
          </p>
        </div>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <>
        <div className="rounded-xl border bg-card p-6">
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileText className="mb-3 h-12 w-12" />
            <p className="text-lg font-medium">No medical records</p>
            <p className="mb-4 text-sm">
              Add the first record for this patient
            </p>
            <Button onClick={() => setEditorOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Visit Note
            </Button>
          </div>
        </div>
        <VisitNoteEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          patientId={patientId}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {data.total} record{data.total !== 1 && "s"}
          </p>
          <Button size="sm" onClick={() => setEditorOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Visit Note
          </Button>
        </div>

        <div className="space-y-3">
          {data.items.map((record) => (
            <Card key={record.id} className="cursor-pointer hover:bg-muted/30">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={recordTypeVariants[record.type] ?? "outline"}
                    >
                      {recordTypeLabels[record.type] ?? record.type}
                    </Badge>
                    <CardTitle className="text-base">{record.title}</CardTitle>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(record.createdAt)}
                  </span>
                </div>
              </CardHeader>
              {record.content != null && (
                <CardContent>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {typeof record.content === "string"
                      ? record.content
                      : JSON.stringify(record.content).slice(0, 200)}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        {data.total > 20 && (
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span className="flex items-center text-sm text-muted-foreground">
              Page {page} of {Math.ceil(data.total / 20)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPage((p) => Math.min(Math.ceil(data.total / 20), p + 1))
              }
              disabled={page >= Math.ceil(data.total / 20)}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      <VisitNoteEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        patientId={patientId}
      />
    </>
  );
}

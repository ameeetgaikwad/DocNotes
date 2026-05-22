"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  MoreHorizontal,
  Archive,
  Download,
  Printer,
  Share2,
  Pencil,
} from "lucide-react";
import { trpc, trpcClient } from "@/lib/trpc";
import {
  formatGender,
  formatPatientName,
  formatPatientAgeDob,
} from "@/lib/format";
import { downloadBase64File, printBase64Pdf } from "@/lib/download";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PatientSummary } from "@/components/patients/patient-summary";
import { PatientHistory } from "@/components/patients/patient-history";
import { PatientDocuments } from "@/components/patients/patient-documents";
import { PatientDiet } from "@/components/patients/patient-diet";
import { PatientPendingDues } from "@/components/patients/patient-pending-dues";
import { ShareDialog } from "@/components/patients/share-dialog";
import { EditPatientDialog } from "@/components/patients/edit-patient-dialog";

export default function PatientProfilePage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = use(params);
  const [shareOpen, setShareOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  // Honour ?tab=<value> so the Patients list can deep-link to a specific
  // tab (Manoj msg 983: "Review" should open History, not Summary).
  const searchParams = useSearchParams();
  const initialTab = (() => {
    const raw = searchParams.get("tab");
    const allowed = [
      "summary",
      "history",
      "documents",
      "diet",
      "pending-dues",
      "appointments",
    ];
    return raw && allowed.includes(raw) ? raw : "summary";
  })();

  const {
    data: patient,
    isLoading,
    error,
  } = useQuery(trpc.patient.getById.queryOptions({ id: patientId }));

  const exportMutation = useMutation({
    mutationFn: (action: "download" | "print") =>
      trpcClient.export.patientSummary
        .mutate({ patientId })
        .then((result) => ({ ...result, action })),
    onSuccess: (data) => {
      if (data.action === "download") {
        downloadBase64File(data.base64, data.filename, "application/pdf");
      } else {
        printBase64Pdf(data.base64);
      }
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <Link
          href="/patients"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Patients
        </Link>
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <AlertCircle className="mb-3 h-12 w-12 text-destructive/60" />
          <p className="text-lg font-medium">Failed to load patient</p>
          <p className="text-sm">
            {error.message.includes("UNAUTHORIZED")
              ? "Please sign in to view this patient"
              : "Check your connection and try again"}
          </p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-4 sm:p-6">
        <Link
          href="/patients"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Patients
        </Link>
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">Patient not found</p>
          <p className="text-sm">
            This patient may have been archived or removed.
          </p>
        </div>
      </div>
    );
  }

  const initials = (patient.firstName[0] ?? "") + (patient.lastName[0] ?? "");
  const fullName = formatPatientName(patient);
  const { age: patientAge, display: dobDisplay } = formatPatientAgeDob(patient);
  const allergies = (patient.allergies ?? []) as Array<{
    name: string;
    severity: string;
    reaction?: string;
  }>;
  const conditions = (patient.activeConditions ?? []) as string[];

  return (
    <div className="p-4 sm:p-6">
      <Link
        href="/patients"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Patients
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <Avatar className="h-12 w-12 text-base sm:h-16 sm:w-16 sm:text-lg">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold sm:text-2xl">
              {fullName}
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              {formatGender(patient.gender)}
              {patientAge != null && <> &middot; {patientAge} years</>}
              {dobDisplay && <> &middot; DOB: {dobDisplay}</>}
              {patient.bloodType && (
                <>
                  {" "}
                  &middot; Blood Type:{" "}
                  <span className="font-medium">{patient.bloodType}</span>
                </>
              )}
            </p>

            {allergies.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {allergies.map((allergy) => (
                  <Badge
                    key={allergy.name}
                    variant={
                      allergy.severity === "severe"
                        ? "destructive"
                        : allergy.severity === "moderate"
                          ? "warning"
                          : "secondary"
                    }
                  >
                    {allergy.name}
                    {allergy.severity === "severe" && " (Severe)"}
                  </Badge>
                ))}
              </div>
            )}

            {conditions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {conditions.map((condition) => (
                  <Badge key={condition} variant="outline">
                    {condition}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
            aria-label="Edit patient"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="h-5 w-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11"
                aria-label="Patient actions"
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => exportMutation.mutate("download")}
                disabled={exportMutation.isPending}
              >
                <Download className="h-4 w-4" />
                {exportMutation.isPending ? "Exporting..." : "Export Records"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => exportMutation.mutate("print")}
                disabled={exportMutation.isPending}
              >
                <Printer className="h-4 w-4" />
                Print Summary
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShareOpen(true)}>
                <Share2 className="h-4 w-4" />
                Share Records
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <Archive className="h-4 w-4" />
                Archive Patient
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs defaultValue={initialTab}>
        <div className="relative">
          <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b bg-transparent p-0 [&::-webkit-scrollbar]:hidden">
            {[
              { value: "summary", label: "Summary" },
              { value: "history", label: "History" },
              { value: "documents", label: "Documents" },
              { value: "diet", label: "Diet" },
              { value: "pending-dues", label: "Pending Dues" },
              { value: "appointments", label: "Appointments" },
            ].map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none md:px-4"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-background to-transparent"
          />
        </div>

        <TabsContent value="summary">
          <PatientSummary patient={patient} />
        </TabsContent>

        <TabsContent value="history">
          <PatientHistory patientId={patient.id} />
        </TabsContent>

        <TabsContent value="documents">
          <PatientDocuments patientId={patient.id} />
        </TabsContent>

        <TabsContent value="diet">
          <PatientDiet
            patientId={patient.id}
            initialDietNotes={patient.dietNotes ?? null}
          />
        </TabsContent>

        <TabsContent value="pending-dues">
          <PatientPendingDues patientId={patient.id} />
        </TabsContent>

        <TabsContent value="appointments">
          <div className="rounded-xl border bg-card p-6">
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p className="text-lg font-medium">Coming soon</p>
              <p className="mt-1 max-w-md text-center text-sm">
                Appointment scheduling per patient isn&apos;t wired into this
                tab yet. Use the Schedule tab in the bottom nav to create
                appointments in the meantime.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        resourceType="patient_summary"
        resourceId={patientId}
        resourceLabel={`${fullName}'s records`}
      />

      <EditPatientDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        patient={patient}
      />
    </div>
  );
}

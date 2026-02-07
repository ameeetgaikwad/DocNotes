import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Edit,
  MoreHorizontal,
  Archive,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatDate, calculateAge, formatGender } from "@/lib/format";
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

export const Route = createFileRoute("/patients/$patientId")({
  component: PatientProfilePage,
});

function PatientProfilePage() {
  const { patientId } = Route.useParams();

  const {
    data: patient,
    isLoading,
    error,
  } = useQuery(trpc.patient.getById.queryOptions({ id: patientId }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Link
          to="/patients"
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
      <div className="p-6">
        <Link
          to="/patients"
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
  const allergies = (patient.allergies ?? []) as Array<{
    name: string;
    severity: string;
    reaction?: string;
  }>;
  const conditions = (patient.activeConditions ?? []) as string[];

  return (
    <div className="p-6">
      <Link
        to="/patients"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Patients
      </Link>

      <div className="mb-6 flex items-start justify-between">
        <div className="flex gap-4">
          <Avatar className="h-16 w-16 text-lg">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-semibold">
              {patient.firstName} {patient.lastName}
            </h1>
            <p className="text-muted-foreground">
              {formatGender(patient.gender)} &middot;{" "}
              {calculateAge(patient.dateOfBirth)} years &middot; DOB:{" "}
              {formatDate(patient.dateOfBirth)}
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

        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4" />
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Export Records</DropdownMenuItem>
              <DropdownMenuItem>Print Summary</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <Archive className="h-4 w-4" />
                Archive Patient
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <PatientSummary patient={patient} />
        </TabsContent>

        <TabsContent value="history">
          <PatientHistory patientId={patient.id} />
        </TabsContent>

        <TabsContent value="appointments">
          <div className="rounded-xl border bg-card p-6">
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p className="text-lg font-medium">No appointments</p>
              <p className="mb-4 text-sm">
                Schedule an appointment for this patient
              </p>
              <Button variant="outline">Schedule Appointment</Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

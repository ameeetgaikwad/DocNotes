import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDate, calculateAge, formatGender } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { NewPatientDialog } from "@/components/patients/new-patient-dialog";

export const Route = createFileRoute("/patients/")({
  component: PatientsPage,
});

function PatientsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const limit = 20;

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, error } = useQuery(
    trpc.patient.list.queryOptions({
      query: debouncedSearch || undefined,
      page,
      limit,
    }),
  );

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Patients</h1>
          <p className="text-muted-foreground">Manage your patient records</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          New Patient
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search patients by name, phone, or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border bg-card">
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <AlertCircle className="mb-3 h-12 w-12 text-destructive/60" />
            <p className="text-lg font-medium">Failed to load patients</p>
            <p className="mb-4 text-sm">
              {error.message.includes("UNAUTHORIZED")
                ? "Please sign in to view patients"
                : "Check your connection and try again"}
            </p>
          </div>
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="rounded-xl border bg-card">
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Users className="mb-3 h-12 w-12" />
            <p className="text-lg font-medium">
              {debouncedSearch ? "No patients found" : "No patients yet"}
            </p>
            <p className="mb-4 text-sm">
              {debouncedSearch
                ? `No results for "${debouncedSearch}"`
                : "Add your first patient to get started"}
            </p>
            {!debouncedSearch && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Add First Patient
              </Button>
            )}
          </div>
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Age / DOB</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Conditions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell>
                      <Link
                        to="/patients/$patientId"
                        params={{ patientId: patient.id }}
                        className="font-medium text-primary hover:underline"
                      >
                        {patient.firstName} {patient.lastName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {calculateAge(patient.dateOfBirth)} yrs
                      </span>{" "}
                      &middot; {formatDate(patient.dateOfBirth)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatGender(patient.gender)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {patient.phone || "—"}
                    </TableCell>
                    <TableCell>
                      {(patient.activeConditions as string[]).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {(patient.activeConditions as string[])
                            .slice(0, 3)
                            .map((condition) => (
                              <Badge key={condition} variant="secondary">
                                {condition}
                              </Badge>
                            ))}
                          {(patient.activeConditions as string[]).length >
                            3 && (
                            <Badge variant="outline">
                              +
                              {(patient.activeConditions as string[]).length -
                                3}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * limit + 1}–
                {Math.min(page * limit, data.total)} of {data.total} patients
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <NewPatientDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

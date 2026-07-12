"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  ArrowLeft,
  ArchiveRestore,
  Trash2,
  Archive,
  Lock,
} from "lucide-react";
import { trpc, trpcClient } from "@/lib/trpc";
import { formatDate, formatPatientName } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogClose as DialogClose,
} from "@/components/ui/responsive-dialog";

type ArchivedPatient = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  phone: string | null;
  updatedAt: Date;
  lastVisitDate: string | null;
  registerEntryCount: number;
  visitCount: number;
  medicalRecordCount: number;
  documentCount: number;
  appointmentCount: number;
};

export default function ArchivedPatientsPage() {
  const queryClient = useQueryClient();
  const archivedQuery = useQuery(trpc.patient.listArchived.queryOptions());
  const [serverError, setServerError] = useState<string | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] =
    useState<ArchivedPatient | null>(null);

  const restoreMutation = useMutation({
    mutationFn: (id: string) => trpcClient.patient.restore.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["patient"]] });
    },
    onError: (e) => setServerError(e.message),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: (id: string) =>
      trpcClient.patient.permanentDelete.mutate({ id }),
    onSuccess: () => {
      setPermanentDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: [["patient"]] });
    },
    onError: (e) => setServerError(e.message),
  });

  const archived = (archivedQuery.data ?? []) as ArchivedPatient[];

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-2 md:mb-8">
        <Link
          href="/patients"
          className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Patients
        </Link>
        <h1 className="text-2xl font-semibold md:text-3xl">Recently Deleted</h1>
        <p className="text-sm text-muted-foreground md:text-base">
          Deleted patients are preserved here. You can Restore them to the
          active list or Permanently Delete (for test or typo entries with no
          clinical history).
        </p>
      </div>

      {serverError && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {serverError}
        </div>
      )}

      {archivedQuery.isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!archivedQuery.isLoading && archived.length === 0 && (
        <div className="rounded-xl border bg-card">
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Archive className="mb-3 h-12 w-12" />
            <p className="text-base font-medium">No deleted patients</p>
            <p className="text-sm">
              Patients you delete from the active list will appear here.
            </p>
          </div>
        </div>
      )}

      {archived.length > 0 && (
        <div className="rounded-xl border bg-card">
          <ul className="divide-y">
            {archived.map((p) => {
              // Manoj msg 2307: check every FK-referencing table, not
              // just register entries. Otherwise the safety pill lied
              // and the delete failed with a raw DB error.
              const totalRefs =
                p.registerEntryCount +
                p.visitCount +
                p.medicalRecordCount +
                p.documentCount +
                p.appointmentCount;
              const hasHistory = totalRefs > 0;
              return (
                <li
                  key={p.id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium md:text-base">
                      {formatPatientName(p)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Deleted {formatDate(p.updatedAt)}
                      {p.phone ? ` · ${p.phone}` : ""}
                    </p>
                    {hasHistory ? (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                        <Lock className="h-3 w-3" />
                        {(() => {
                          const parts: string[] = [];
                          if (p.registerEntryCount > 0)
                            parts.push(
                              `${p.registerEntryCount} register ${
                                p.registerEntryCount === 1 ? "entry" : "entries"
                              }`,
                            );
                          if (p.visitCount > 0)
                            parts.push(
                              `${p.visitCount} ${p.visitCount === 1 ? "visit" : "visits"}`,
                            );
                          if (p.appointmentCount > 0)
                            parts.push(
                              `${p.appointmentCount} ${p.appointmentCount === 1 ? "appointment" : "appointments"}`,
                            );
                          if (p.documentCount > 0)
                            parts.push(
                              `${p.documentCount} ${p.documentCount === 1 ? "document" : "documents"}`,
                            );
                          if (p.medicalRecordCount > 0)
                            parts.push(
                              `${p.medicalRecordCount} older ${p.medicalRecordCount === 1 ? "note" : "notes"}`,
                            );
                          return parts.join(" · ");
                        })()}
                        {p.lastVisitDate
                          ? ` · last visit ${formatDate(p.lastVisitDate)}`
                          : ""}{" "}
                        — cannot permanently delete
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">
                        No clinical records — safe to permanently delete
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 sm:shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setServerError(null);
                        restoreMutation.mutate(p.id);
                      }}
                      disabled={restoreMutation.isPending}
                    >
                      <ArchiveRestore className="h-4 w-4" />
                      Restore
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setServerError(null);
                        setPermanentDeleteTarget(p);
                      }}
                      disabled={hasHistory}
                      title={
                        hasHistory
                          ? "Blocked: clinical history must be retained by law"
                          : "Permanently delete this stub patient"
                      }
                      className={
                        hasHistory
                          ? undefined
                          : "text-destructive hover:text-destructive"
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                      Permanent Delete
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Dialog
        open={permanentDeleteTarget !== null}
        onOpenChange={(v) => {
          if (!v) setPermanentDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Permanently delete patient?</DialogTitle>
            <DialogDescription>
              This will erase{" "}
              <strong>
                {permanentDeleteTarget
                  ? formatPatientName(permanentDeleteTarget)
                  : ""}
              </strong>{" "}
              from the database. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200">
            This action is only permitted for patients with no clinical history.
            <br />
            The server will refuse if any register entries, visits, or
            prescriptions exist.
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (permanentDeleteTarget) {
                  permanentDeleteMutation.mutate(permanentDeleteTarget.id);
                }
              }}
              disabled={permanentDeleteMutation.isPending}
            >
              {permanentDeleteMutation.isPending
                ? "Deleting…"
                : "Permanently Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

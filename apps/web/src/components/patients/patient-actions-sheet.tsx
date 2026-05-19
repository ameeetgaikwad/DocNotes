"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Bookmark, Trash2, Loader2 } from "lucide-react";
import { trpcClient } from "@/lib/trpc";
import { formatPatientName } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogDescription as DialogDescription,
} from "@/components/ui/responsive-dialog";

interface PatientActionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: {
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
  };
}

export function PatientActionsSheet({
  open,
  onOpenChange,
  patient,
}: PatientActionsSheetProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const archiveMutation = useMutation({
    mutationFn: () => trpcClient.patient.archive.mutate({ id: patient.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["patient"]] });
      setConfirmDelete(false);
      onOpenChange(false);
    },
  });

  function openReview() {
    onOpenChange(false);
    router.push(`/patients/${patient.id}?tab=history`);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setConfirmDelete(false);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{formatPatientName(patient)}</DialogTitle>
          <DialogDescription>What would you like to do?</DialogDescription>
        </DialogHeader>

        {confirmDelete ? (
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">
              Archive{" "}
              <span className="font-medium text-foreground">
                {formatPatientName(patient)}
              </span>
              ? The patient will be hidden from this list but their visit
              history and register entries are kept.
            </p>
            {archiveMutation.error && (
              <p className="text-sm text-destructive">
                {archiveMutation.error.message}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(false)}
                disabled={archiveMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => archiveMutation.mutate()}
                disabled={archiveMutation.isPending}
              >
                {archiveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting
                  </>
                ) : (
                  <>Delete patient</>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 justify-start text-base"
              onClick={openReview}
            >
              <BookOpen className="h-5 w-5" />
              Review — open History
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 justify-start text-base"
              disabled
              title="Coming soon — needs a database change"
            >
              <Bookmark className="h-5 w-5" />
              Mark <span className="ml-1 text-xs">(coming soon)</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 justify-start border-destructive/40 text-base text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-5 w-5" />
              Delete
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

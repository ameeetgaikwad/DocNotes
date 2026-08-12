"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, CalendarDays } from "lucide-react";
import {
  CLINIC_HOLIDAY_REASONS,
  CLINIC_HOLIDAY_REASON_LABELS,
  type ClinicHolidayReason,
} from "@docnotes/shared";
import { trpc, trpcClient } from "@/lib/trpc";
import { formatDate, todayLocalIsoDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { CalendarInput } from "@/components/ui/calendar-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from "@/components/ui/responsive-dialog";

type HolidayRow = {
  id: string;
  holidayDate: string;
  reason: ClinicHolidayReason;
  note: string | null;
};

export default function ClinicHolidaysPage() {
  const queryClient = useQueryClient();
  const listQuery = useQuery(trpc.clinicHoliday.list.queryOptions());
  const [editing, setEditing] = useState<HolidayRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: HolidayRow) {
    setEditing(row);
    setFormOpen(true);
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => trpcClient.clinicHoliday.delete.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["clinicHoliday"]] });
    },
  });

  function handleDelete(row: HolidayRow) {
    // Hard delete per Manoj msg 2597 — confirm explicitly so the
    // doctor doesn't lose the row by accident.
    const label = `${formatDate(row.holidayDate)} — ${CLINIC_HOLIDAY_REASON_LABELS[row.reason]}`;
    if (window.confirm(`Delete "${label}"? This can't be undone.`)) {
      deleteMutation.mutate(row.id);
    }
  }

  const rows = (listQuery.data ?? []) as HolidayRow[];

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <PageHeader
        title="Clinic Holidays"
        subtitle="Dates the clinic was closed — holidays, personal leave, festivals, etc."
        backHref="/reports"
        backLabel="Back to Reports"
        action={
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        }
      />

      <div className="rounded-xl border bg-card">
        {listQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <CalendarDays className="h-10 w-10 opacity-40" />
            <p className="text-base font-medium">No closed dates logged yet</p>
            <p className="text-sm">Add a date to keep a running record.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={openNew}
            >
              <Plus className="h-4 w-4" />
              Add first entry
            </Button>
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <p className="font-semibold">
                      {formatDate(row.holidayDate)}
                    </p>
                    <span className="rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {CLINIC_HOLIDAY_REASON_LABELS[row.reason]}
                    </span>
                  </div>
                  {row.note && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {row.note}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1 self-end sm:self-auto">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => openEdit(row)}
                    aria-label="Edit"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleDelete(row)}
                    disabled={deleteMutation.isPending}
                    aria-label="Delete"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ClinicHolidayFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
      />
    </div>
  );
}

function ClinicHolidayFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: HolidayRow | null;
}) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState<string>(
    editing?.holidayDate ?? todayLocalIsoDate(),
  );
  const [reason, setReason] = useState<ClinicHolidayReason>(
    editing?.reason ?? "holiday",
  );
  const [note, setNote] = useState(editing?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  // Reset form state whenever the dialog opens with different context
  // (new vs edit, or a different row).
  const seedKey = editing?.id ?? "new";
  const [lastSeed, setLastSeed] = useState<string | null>(null);
  if (open && lastSeed !== seedKey) {
    setDate(editing?.holidayDate ?? todayLocalIsoDate());
    setReason(editing?.reason ?? "holiday");
    setNote(editing?.note ?? "");
    setError(null);
    setLastSeed(seedKey);
  }
  if (!open && lastSeed !== null) {
    setLastSeed(null);
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      trpcClient.clinicHoliday.upsert.mutate({
        id: editing?.id,
        holidayDate: date,
        reason,
        note: note.trim() ? note.trim() : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["clinicHoliday"]] });
      onOpenChange(false);
    },
    onError: (err) => setError(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit closed date" : "Add closed date"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="holiday-date">Date</Label>
            <CalendarInput id="holiday-date" value={date} onChange={setDate} />
          </div>
          <div>
            <Label>Reason</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {CLINIC_HOLIDAY_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs",
                    reason === r
                      ? "border-primary bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {CLINIC_HOLIDAY_REASON_LABELS[r]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="holiday-note">Note (optional)</Label>
            <Input
              id="holiday-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Diwali, family function"
              maxLength={500}
            />
          </div>
          {error && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !date}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving
                </>
              ) : editing ? (
                "Save changes"
              ) : (
                "Add entry"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

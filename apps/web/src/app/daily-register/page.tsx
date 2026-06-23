"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Loader2,
  AlertCircle,
  BookOpen,
  Trash2,
  Pencil,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { todayLocalIsoDate, formatPatientName } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { CalendarInput } from "@/components/ui/calendar-input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { NewDailyRegisterEntryDialog } from "@/components/daily-register/new-entry-dialog";
import { DeleteEntryButton } from "@/components/daily-register/delete-entry-button";
import {
  EditDailyRegisterEntryDialog,
  type RegisterEntryForEdit,
} from "@/components/daily-register/edit-entry-dialog";

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function DailyRegisterPage() {
  const [visitDate, setVisitDate] = useState(todayLocalIsoDate());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<RegisterEntryForEdit | null>(
    null,
  );

  const { data, isLoading, error } = useQuery(
    trpc.dailyRegister.list.queryOptions({ visitDate }),
  );

  const isToday = useMemo(() => visitDate === todayLocalIsoDate(), [visitDate]);

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between md:mb-8">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">
            Daily Case Register
          </h1>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="self-start md:h-12 md:px-6 md:text-base"
        >
          <Plus className="h-4 w-4 md:h-5 md:w-5" />
          Add Entry
        </Button>
      </div>

      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end md:mb-8 md:gap-4">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="visit-date"
            className="text-sm font-medium text-muted-foreground"
          >
            Date
          </label>
          <CalendarInput
            id="visit-date"
            value={visitDate}
            onChange={(v) => v && setVisitDate(v)}
            max={todayLocalIsoDate()}
            className="w-44 md:h-12 md:text-base"
          />
        </div>
        {!isToday && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisitDate(todayLocalIsoDate())}
            className="md:h-12 md:px-4 md:text-base"
          >
            Jump to today
          </Button>
        )}
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
            <p className="text-lg font-medium">Failed to load register</p>
            <p className="mb-4 text-sm">
              {error.message.includes("UNAUTHORIZED")
                ? "Please sign in to view the register"
                : "Check your connection and try again"}
            </p>
          </div>
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="rounded-xl border bg-card">
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground md:py-24">
            <BookOpen className="mb-3 h-12 w-12 md:mb-4 md:h-16 md:w-16" />
            <p className="text-lg font-medium md:text-xl">
              No entries for this date
            </p>
            <p className="mb-4 text-sm md:mb-6 md:text-base">
              Add today&apos;s first patient visit to get started
            </p>
            <Button
              onClick={() => setDialogOpen(true)}
              className="md:h-12 md:px-6 md:text-base"
            >
              <Plus className="h-4 w-4 md:h-5 md:w-5" />
              Add Entry
            </Button>
          </div>
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          {(() => {
            const unrecordedCount = data.items.filter(
              (e) =>
                e.paymentStatus !== "nil" && Number(e.feeAmount ?? 0) === 0,
            ).length;
            if (unrecordedCount === 0) return null;
            return (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700/50 dark:bg-amber-950/30">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-amber-900 dark:text-amber-200">
                  {unrecordedCount}{" "}
                  {unrecordedCount === 1 ? "entry" : "entries"} on this date{" "}
                  {unrecordedCount === 1 ? "doesn't have" : "don't have"} fees
                  recorded yet — tap the row to fill them in once settled.
                </p>
              </div>
            );
          })()}

          {/* Mobile: card per entry. Desktop (≥md): table. */}
          <ul className="space-y-2 md:hidden">
            {data.items.map((entry, idx) => {
              const statusLabel =
                entry.paymentStatus === "paid"
                  ? "Paid"
                  : entry.paymentStatus === "due"
                    ? "Due"
                    : "Nil";
              const feesUnrecorded =
                entry.paymentStatus !== "nil" &&
                Number(entry.feeAmount ?? 0) === 0;
              const meta = [
                entry.serviceType || null,
                entry.paymentStatus !== "nil"
                  ? entry.paymentMode === "cash"
                    ? "Cash"
                    : "Digital / UPI"
                  : null,
                entry.diagnosis || null,
              ].filter((s): s is string => Boolean(s));
              return (
                <li key={entry.id} className="rounded-xl border bg-card p-3">
                  <button
                    type="button"
                    onClick={() => setEditingEntry(entry)}
                    className="flex w-full items-start justify-between gap-3 text-left"
                    aria-label="Edit entry"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs text-muted-foreground">
                          #{idx + 1}
                        </span>
                        <span className="truncate font-medium text-primary">
                          {formatPatientName(entry.patient)}
                        </span>
                      </div>
                      {meta.length > 0 && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {meta.join(" · ")}
                        </p>
                      )}
                      {entry.notes && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-mono text-sm">
                        {entry.paymentStatus === "nil"
                          ? "—"
                          : formatINR(Number(entry.feeAmount))}
                      </span>
                      <Badge
                        variant={
                          entry.paymentStatus === "paid"
                            ? "default"
                            : entry.paymentStatus === "due"
                              ? "outline"
                              : "secondary"
                        }
                      >
                        {statusLabel}
                      </Badge>
                      {feesUnrecorded && (
                        <Badge variant="warning" className="text-[10px]">
                          Fees not recorded
                        </Badge>
                      )}
                    </div>
                  </button>
                  <div className="mt-2 flex items-center justify-end gap-2 border-t pt-2 text-xs">
                    <Link
                      href={`/patients/${entry.patient.id}?from=register`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      View Patient Card
                    </Link>
                    <span className="text-muted-foreground/40">·</span>
                    <DeleteEntryButton entryId={entry.id} visitDate={visitDate}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </DeleteEntryButton>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
            <Table className="md:text-base">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Service
                  </TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Mode</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Diagnosis
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Remarks
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((entry, idx) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground md:py-4">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="font-medium md:py-4">
                      <Link
                        href={`/patients/${entry.patient.id}?from=register`}
                        className="text-primary hover:underline"
                      >
                        {formatPatientName(entry.patient)}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell md:py-4">
                      {entry.serviceType || "—"}
                    </TableCell>
                    <TableCell className="font-mono md:py-4">
                      {entry.paymentStatus === "nil"
                        ? "—"
                        : formatINR(Number(entry.feeAmount))}
                    </TableCell>
                    <TableCell className="md:py-4">
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge
                          variant={
                            entry.paymentStatus === "paid"
                              ? "default"
                              : entry.paymentStatus === "due"
                                ? "outline"
                                : "secondary"
                          }
                        >
                          {entry.paymentStatus === "paid"
                            ? "Paid"
                            : entry.paymentStatus === "due"
                              ? "Due"
                              : "Nil"}
                        </Badge>
                        {entry.paymentStatus !== "nil" &&
                          Number(entry.feeAmount ?? 0) === 0 && (
                            <Badge variant="warning" className="text-[10px]">
                              Fees not recorded
                            </Badge>
                          )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell md:py-4">
                      {entry.paymentStatus === "nil" ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Badge
                          variant={
                            entry.paymentMode === "cash"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {entry.paymentMode === "cash"
                            ? "Cash"
                            : "Digital / UPI"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell md:py-4">
                      {entry.diagnosis || "—"}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell md:py-4">
                      {entry.notes || "—"}
                    </TableCell>
                    <TableCell className="md:py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingEntry(entry)}
                          aria-label="Edit entry"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4 md:h-5 md:w-5" />
                        </button>
                        <DeleteEntryButton
                          entryId={entry.id}
                          visitDate={visitDate}
                        >
                          <Trash2 className="h-4 w-4 md:h-5 md:w-5" />
                        </DeleteEntryButton>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 md:mt-6 md:grid-cols-4 md:gap-4">
            <div className="rounded-xl border bg-card p-4 md:p-5">
              <p className="text-sm text-muted-foreground">Total Cash</p>
              <p className="mt-1 text-xl font-semibold md:text-2xl">
                {formatINR(data.totals.cash)}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4 md:p-5">
              <p className="text-sm text-muted-foreground">Total Digital</p>
              <p className="mt-1 text-xl font-semibold md:text-2xl">
                {formatINR(data.totals.digital)}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4 md:p-5">
              <p className="text-sm text-muted-foreground">Outstanding (Due)</p>
              <p className="mt-1 text-xl font-semibold md:text-2xl">
                {formatINR(data.totals.due)}
              </p>
            </div>
            <div className="rounded-xl border bg-primary/10 p-4 md:p-5">
              <p className="text-sm text-muted-foreground">Received Today</p>
              <p className="mt-1 text-xl font-semibold md:text-2xl">
                {formatINR(data.totals.all)}
              </p>
            </div>
          </div>
        </>
      )}

      <NewDailyRegisterEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        visitDate={visitDate}
      />

      <EditDailyRegisterEntryDialog
        open={editingEntry !== null}
        onOpenChange={(o) => !o && setEditingEntry(null)}
        entry={editingEntry}
      />

      {/* Manoj msg 1820: mirror the top "Add Entry" button as a floating
          circular FAB at the bottom-left so a doctor mid-scroll doesn't
          need to scroll up to add another entry. Bottom offset clears
          the MobileBottomNav (h-14 + safe-area). Left side keeps the
          FAB out of the way of the right-handed-thumb area where users
          tap nav items. Mobile-only — desktop already has the top
          button visible at all times. */}
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        aria-label="Add Entry"
        className="fixed bottom-20 left-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 active:scale-95 md:hidden"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)" }}
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}

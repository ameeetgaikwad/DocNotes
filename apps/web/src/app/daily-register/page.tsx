"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Loader2, AlertCircle, BookOpen, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
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
import { NewDailyRegisterEntryDialog } from "@/components/daily-register/new-entry-dialog";
import { DeleteEntryButton } from "@/components/daily-register/delete-entry-button";

function todayLocalIsoDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

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

  const { data, isLoading, error } = useQuery(
    trpc.dailyRegister.list.queryOptions({ visitDate }),
  );

  const isToday = useMemo(() => visitDate === todayLocalIsoDate(), [visitDate]);

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between md:mb-8">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Daily Register</h1>
          <p className="text-muted-foreground md:text-base">
            Daily case register (Form 25) — patient visits and fees received
          </p>
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
          <Input
            id="visit-date"
            type="date"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            max={todayLocalIsoDate()}
            className="w-auto md:h-12 md:text-base"
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
          <div className="overflow-x-auto rounded-xl border bg-card">
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
                      {entry.patient.firstName} {entry.patient.lastName}
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
                      <DeleteEntryButton
                        entryId={entry.id}
                        visitDate={visitDate}
                      >
                        <Trash2 className="h-4 w-4 md:h-5 md:w-5" />
                      </DeleteEntryButton>
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
    </div>
  );
}

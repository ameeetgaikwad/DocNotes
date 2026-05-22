"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download, Printer, Loader2 } from "lucide-react";
import { trpcClient } from "@/lib/trpc";
import {
  currentFinancialYear,
  fyLabel,
  fyRange,
  todayLocalIsoDate,
} from "@/lib/format";
import { downloadBase64File, printBase64Pdf } from "@/lib/download";
import { Button } from "@/components/ui/button";
import { CalendarInput } from "@/components/ui/calendar-input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogDescription as DialogDescription,
} from "@/components/ui/responsive-dialog";

function thisMonthRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const mm = String(m + 1).padStart(2, "0");
  return {
    startDate: `${y}-${mm}-01`,
    endDate: `${y}-${mm}-${String(last).padStart(2, "0")}`,
  };
}

interface ExportDailyRegisterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportDailyRegisterDialog({
  open,
  onOpenChange,
}: ExportDailyRegisterDialogProps) {
  const today = todayLocalIsoDate();
  const fy = currentFinancialYear();
  const initialFy = fyRange(fy);
  const [startDate, setStartDate] = useState(initialFy.startDate);
  const [endDate, setEndDate] = useState(today);
  const [error, setError] = useState<string | null>(null);

  const exportMutation = useMutation({
    mutationFn: () =>
      trpcClient.export.dailyRegister.mutate({ startDate, endDate }),
    onError: (e) => setError(e.message),
  });

  function applyShortcut(range: { startDate: string; endDate: string }) {
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setError(null);
  }

  async function runExport(action: "print" | "download") {
    setError(null);
    const result = await exportMutation.mutateAsync();
    if (!result?.base64) return;
    if (action === "print") {
      printBase64Pdf(result.base64);
    } else {
      downloadBase64File(result.base64, result.filename, "application/pdf");
    }
  }

  const rangeValid = startDate && endDate && startDate <= endDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Daily Case Register</DialogTitle>
          <DialogDescription>
            Pick a date range or use a Financial Year shortcut. The PDF groups
            entries by visit date.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="export-from">From</Label>
              <CalendarInput
                id="export-from"
                value={startDate}
                onChange={(v) => setStartDate(v ?? "")}
                max={endDate || today}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="export-to">To</Label>
              <CalendarInput
                id="export-to"
                value={endDate}
                onChange={(v) => setEndDate(v ?? "")}
                min={startDate || undefined}
                max={today}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyShortcut(thisMonthRange())}
            >
              This month
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyShortcut(fyRange(fy))}
            >
              {fyLabel(fy)}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyShortcut(fyRange(fy - 1))}
            >
              {fyLabel(fy - 1)}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                applyShortcut({ startDate: today, endDate: today })
              }
            >
              Today
            </Button>
          </div>

          {!rangeValid && (
            <p className="text-xs text-destructive">
              From date must be on or before To date.
            </p>
          )}

          {error && (
            <p className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={exportMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => runExport("download")}
              disabled={!rangeValid || exportMutation.isPending}
            >
              {exportMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download
            </Button>
            <Button
              type="button"
              onClick={() => runExport("print")}
              disabled={!rangeValid || exportMutation.isPending}
            >
              {exportMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

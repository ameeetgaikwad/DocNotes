"use client";

import { useState } from "react";
import { BookOpen, ChevronRight, FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ExportDailyRegisterDialog } from "@/components/daily-register/export-dialog";

export default function ReportsPage() {
  const [exportDcrOpen, setExportDcrOpen] = useState(false);

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <PageHeader
        title="Reports"
        subtitle="Generate and export reports for record-keeping"
        backHref="/"
        backLabel="Back to Dashboard"
      />

      <div className="rounded-xl border bg-card">
        <ul className="divide-y">
          <li>
            <button
              type="button"
              onClick={() => setExportDcrOpen(true)}
              className="flex w-full items-center gap-3 px-4 py-4 text-left transition active:bg-muted/40 sm:px-6"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">Export Daily Case Register</p>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Printer-friendly PDF of Form 25 for any date range, grouped by
                  visit date with continuous serial numbering.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </button>
          </li>
        </ul>
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        More reports (fee summaries, patient logs) will land here over time.
      </p>

      <ExportDailyRegisterDialog
        open={exportDcrOpen}
        onOpenChange={setExportDcrOpen}
      />
    </div>
  );
}

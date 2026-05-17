import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

export default function ReportsPage() {
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <PageHeader
        title="Reports"
        subtitle="Generate and export patient reports"
        backHref="/"
        backLabel="Back to Dashboard"
      />

      <div className="rounded-xl border bg-card">
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FileText className="mb-3 h-12 w-12" />
          <p className="text-lg font-medium">Coming soon</p>
          <p className="mt-1 max-w-md text-center text-sm">
            Generated patient PDFs, fee summaries, and visit logs will live
            here. Nothing&apos;s wired up yet — use the back link above to
            return to the dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}

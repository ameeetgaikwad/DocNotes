import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/reports/")({
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-muted-foreground">
          Generate and export patient reports
        </p>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FileText className="mb-3 h-12 w-12" />
          <p className="text-lg font-medium">No reports generated</p>
          <p className="text-sm">
            Export patient records and generate PDF reports here
          </p>
        </div>
      </div>
    </div>
  );
}

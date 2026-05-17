import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

export default function TasksPage() {
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <PageHeader
        title="Tasks"
        subtitle="Follow-ups, reminders, and pending actions"
        backHref="/"
        backLabel="Back to Dashboard"
      />

      <div className="rounded-xl border bg-card">
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <ClipboardList className="mb-3 h-12 w-12" />
          <p className="text-lg font-medium">Coming soon</p>
          <p className="mt-1 max-w-md text-center text-sm">
            Tasks tied to appointments and follow-ups will appear here.
            Nothing&apos;s wired up yet — use the back link above to return to
            the dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}

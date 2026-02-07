import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";

export const Route = createFileRoute("/tasks/")({
  component: TasksPage,
});

function TasksPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <p className="text-muted-foreground">
          Follow-ups, reminders, and pending actions
        </p>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <ClipboardList className="mb-3 h-12 w-12" />
          <p className="text-lg font-medium">No pending tasks</p>
          <p className="text-sm">
            Tasks from appointments and follow-ups will appear here
          </p>
        </div>
      </div>
    </div>
  );
}

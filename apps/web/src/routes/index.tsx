import { createFileRoute } from "@tanstack/react-router";
import { Calendar, Users, ClipboardList, Activity } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, Doctor</p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's Appointments" value="0" icon={Calendar} />
        <StatCard label="Total Patients" value="0" icon={Users} />
        <StatCard label="Pending Tasks" value="0" icon={ClipboardList} />
        <StatCard label="Records This Week" value="0" icon={Activity} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-xl border bg-card p-6 lg:col-span-3">
          <h2 className="mb-4 text-lg font-semibold">Today&apos;s Schedule</h2>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Calendar className="mb-3 h-10 w-10" />
            <p>No appointments scheduled for today</p>
            <p className="text-sm">
              Appointments will appear here once you start scheduling
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold">Action Items</h2>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ClipboardList className="mb-3 h-10 w-10" />
            <p>No pending actions</p>
            <p className="text-sm">Tasks and reminders will appear here</p>
          </div>
        </div>
      </div>
    </div>
  );
}

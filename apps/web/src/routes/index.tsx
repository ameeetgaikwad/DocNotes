import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Users,
  ClipboardList,
  Activity,
  Loader2,
  Clock,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function StatCard({
  label,
  value,
  icon: Icon,
  isLoading,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  isLoading?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          {isLoading ? (
            <Loader2 className="mt-2 h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          )}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </div>
  );
}

function formatTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

const typeLabels: Record<string, string> = {
  new_patient: "New Patient",
  follow_up: "Follow-up",
  routine: "Routine",
  urgent: "Urgent",
  telehealth: "Telehealth",
};

function Dashboard() {
  const { data, isLoading } = useQuery(trpc.dashboard.stats.queryOptions());

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, Doctor</p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today's Appointments"
          value={data?.todayAppointments ?? 0}
          icon={Calendar}
          isLoading={isLoading}
        />
        <StatCard
          label="Total Patients"
          value={data?.totalPatients ?? 0}
          icon={Users}
          isLoading={isLoading}
        />
        <StatCard label="Pending Tasks" value="0" icon={ClipboardList} />
        <StatCard
          label="Records This Week"
          value={data?.recordsThisWeek ?? 0}
          icon={Activity}
          isLoading={isLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-xl border bg-card p-6 lg:col-span-3">
          <h2 className="mb-4 text-lg font-semibold">Today&apos;s Schedule</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : data?.todaySchedule && data.todaySchedule.length > 0 ? (
            <div className="space-y-3">
              {data.todaySchedule.map((appt) => (
                <div
                  key={appt.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <div className="flex w-16 flex-col items-center text-center">
                    <span className="text-sm font-medium">
                      {formatTime(appt.scheduledAt)}
                    </span>
                    <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {appt.durationMinutes}m
                    </span>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        Patient: {appt.patientId.slice(0, 8)}...
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {typeLabels[appt.type] ?? appt.type}
                      </Badge>
                    </div>
                    {appt.reason && (
                      <p className="text-xs text-muted-foreground">
                        {appt.reason}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              <Link
                to="/schedule"
                className="block text-center text-sm text-primary hover:underline"
              >
                View full schedule
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Calendar className="mb-3 h-10 w-10" />
              <p>No appointments scheduled for today</p>
              <p className="text-sm">
                Appointments will appear here once you start scheduling
              </p>
            </div>
          )}
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

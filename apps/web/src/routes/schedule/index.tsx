import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { NewAppointmentDialog } from "@/components/schedule/new-appointment-dialog";

export const Route = createFileRoute("/schedule/")({
  component: SchedulePage,
});

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(date: Date): string {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

const statusLabels: Record<string, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  checked_in: "Checked In",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
};

const statusVariants: Record<
  string,
  "default" | "secondary" | "outline" | "success" | "warning" | "destructive"
> = {
  scheduled: "secondary",
  confirmed: "default",
  checked_in: "warning",
  in_progress: "default",
  completed: "success",
  cancelled: "destructive",
  no_show: "outline",
};

const typeLabels: Record<string, string> = {
  new_patient: "New Patient",
  follow_up: "Follow-up",
  routine: "Routine",
  urgent: "Urgent",
  telehealth: "Telehealth",
};

function SchedulePage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [dialogOpen, setDialogOpen] = useState(false);

  const dayStart = new Date(selectedDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(selectedDate);
  dayEnd.setHours(23, 59, 59, 999);

  const { data, isLoading, error } = useQuery(
    trpc.appointment.list.queryOptions({
      from: dayStart,
      to: dayEnd,
      page: 1,
      limit: 50,
    }),
  );

  const goToPreviousDay = () => {
    setSelectedDate((d) => {
      const prev = new Date(d);
      prev.setDate(prev.getDate() - 1);
      return prev;
    });
  };

  const goToNextDay = () => {
    setSelectedDate((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      return next;
    });
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const isToday = toDateString(selectedDate) === toDateString(new Date());

  const appointments = data?.items ?? [];
  const sortedAppointments = [...appointments].sort(
    (a, b) =>
      new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Schedule</h1>
          <p className="text-muted-foreground">
            Manage appointments and availability
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          New Appointment
        </Button>
      </div>

      <div className="mb-6 flex items-center justify-between rounded-lg border bg-card p-3">
        <Button variant="ghost" size="icon" onClick={goToPreviousDay}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-medium">
            {formatDisplayDate(selectedDate)}
          </h2>
          {!isToday && (
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={goToNextDay}>
          <ChevronRight className="h-4 w-4" />
        </Button>
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
            <p className="text-lg font-medium">Failed to load schedule</p>
            <p className="text-sm">
              {error.message.includes("UNAUTHORIZED")
                ? "Please sign in to view appointments"
                : "Check your connection and try again"}
            </p>
          </div>
        </div>
      )}

      {data && sortedAppointments.length === 0 && (
        <div className="rounded-xl border bg-card">
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Calendar className="mb-3 h-12 w-12" />
            <p className="text-lg font-medium">No appointments for this day</p>
            <p className="mb-4 text-sm">
              {isToday
                ? "Your schedule is clear today"
                : "No appointments scheduled"}
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Schedule Appointment
            </Button>
          </div>
        </div>
      )}

      {data && sortedAppointments.length > 0 && (
        <div className="space-y-3">
          {sortedAppointments.map((appointment) => (
            <Card key={appointment.id} className="hover:bg-muted/30">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex w-20 flex-col items-center text-center">
                  <span className="text-sm font-medium">
                    {formatTime(appointment.scheduledAt)}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {appointment.durationMinutes}m
                  </span>
                </div>

                <div className="h-10 w-px bg-border" />

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      Patient: {appointment.patientId.slice(0, 8)}...
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {typeLabels[appointment.type] ?? appointment.type}
                    </Badge>
                  </div>
                  {appointment.reason && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {appointment.reason}
                    </p>
                  )}
                </div>

                <Badge
                  variant={statusVariants[appointment.status] ?? "outline"}
                >
                  {statusLabels[appointment.status] ?? appointment.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NewAppointmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultDate={toDateString(selectedDate)}
      />
    </div>
  );
}

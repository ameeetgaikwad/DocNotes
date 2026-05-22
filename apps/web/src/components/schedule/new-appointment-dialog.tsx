import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { trpc, trpcClient } from "@/lib/trpc";
import { todayLocalIsoDate, formatPatientName } from "@/lib/format";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { CalendarInput } from "@/components/ui/calendar-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogClose as DialogClose,
} from "@/components/ui/responsive-dialog";

const appointmentFormSchema = z.object({
  patientId: z.string().uuid("Please enter a valid patient ID"),
  date: z.string().min(1, "Date is required"),
  // Time is optional — falls back to 09:00 on submit per Manoj msg 876.
  time: z.string().optional(),
  durationMinutes: z.coerce.number().int().positive(),
  type: z.enum(["new_patient", "follow_up", "routine", "urgent", "telehealth"]),
  reason: z.string().max(500).optional(),
  notes: z.string().optional(),
});

type AppointmentFormValues = z.infer<typeof appointmentFormSchema>;

interface NewAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string;
}

export function NewAppointmentDialog({
  open,
  onOpenChange,
  defaultDate,
}: NewAppointmentDialogProps) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const today = todayLocalIsoDate();

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
      patientId: "",
      date: defaultDate ?? today,
      time: "09:00",
      durationMinutes: 15,
      type: "follow_up",
      reason: "",
      notes: "",
    },
  });

  // Patient picker — search by name, tap a match to set patientId. No
  // more "paste this UUID" UX (Manoj msg 866).
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const debouncedSearch = useDebounce(patientSearch.trim(), 250);
  const patientsQuery = useQuery({
    ...trpc.patient.list.queryOptions({
      query: debouncedSearch || undefined,
      page: 1,
      limit: 8,
    }),
    enabled: open && !selectedPatient && debouncedSearch.length > 0,
  });
  const watchedPatientId = watch("patientId");

  const createMutation = useMutation({
    mutationFn: (data: AppointmentFormValues) => {
      const time = data.time?.trim() || "09:00";
      const scheduledAt = new Date(`${data.date}T${time}:00`);
      return trpcClient.appointment.create.mutate({
        patientId: data.patientId,
        type: data.type,
        scheduledAt,
        durationMinutes: data.durationMinutes,
        reason: data.reason || null,
        notes: data.notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["appointment"]] });
      reset();
      setServerError(null);
      onOpenChange(false);
    },
    onError: (error) => {
      setServerError(error.message);
    },
  });

  const onSubmit = (data: AppointmentFormValues) => {
    setServerError(null);
    createMutation.mutate(data);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      reset();
      setServerError(null);
      setPatientSearch("");
      setSelectedPatient(null);
    }
    onOpenChange(nextOpen);
  };

  function pickPatient(p: {
    id: string;
    firstName: string;
    middleName?: string | null;
    lastName: string;
  }) {
    const label = formatPatientName(p);
    setSelectedPatient({ id: p.id, label });
    setValue("patientId", p.id, { shouldValidate: true });
    setPatientSearch("");
  }

  function clearPatient() {
    setSelectedPatient(null);
    setValue("patientId", "", { shouldValidate: true });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Appointment</DialogTitle>
          <DialogDescription>
            Schedule a new appointment. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {serverError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="patientSearch">Patient *</Label>
            <input type="hidden" {...register("patientId")} />
            {selectedPatient ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <span className="font-medium">{selectedPatient.label}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearPatient}
                >
                  Change
                </Button>
              </div>
            ) : (
              <>
                <Input
                  id="patientSearch"
                  type="text"
                  placeholder="Search by name, phone, or diagnosis"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  autoFocus
                />
                {debouncedSearch.length > 0 && (
                  <div className="max-h-48 overflow-y-auto rounded-md border">
                    {patientsQuery.isLoading && (
                      <p className="p-3 text-xs text-muted-foreground">
                        Searching…
                      </p>
                    )}
                    {!patientsQuery.isLoading &&
                      (patientsQuery.data?.items.length ?? 0) === 0 && (
                        <p className="p-3 text-xs text-muted-foreground">
                          No patients match &ldquo;{debouncedSearch}&rdquo;
                        </p>
                      )}
                    {patientsQuery.data?.items.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => pickPatient(p)}
                        className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <span className="font-medium">
                          {formatPatientName(p)}
                        </span>
                        {p.phone && (
                          <span className="text-xs text-muted-foreground">
                            {p.phone}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {errors.patientId &&
              !selectedPatient &&
              watchedPatientId === "" && (
                <p className="text-xs text-destructive">
                  Pick a patient from the list above.
                </p>
              )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Controller
                control={control}
                name="date"
                render={({ field }) => (
                  <CalendarInput
                    id="date"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                )}
              />
              {errors.date && (
                <p className="text-xs text-destructive">
                  {errors.date.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Controller
                control={control}
                name="time"
                render={({ field }) => (
                  <TimePicker
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                )}
              />
              {errors.time && (
                <p className="text-xs text-destructive">
                  {errors.time.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select id="type" {...register("type")}>
                <option value="new_patient">New Patient</option>
                <option value="follow_up">Follow-up</option>
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="telehealth">Telehealth</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="durationMinutes">Duration (min)</Label>
              <Select id="durationMinutes" {...register("durationMinutes")}>
                <option value="10">10 min</option>
                <option value="15">15 min</option>
                <option value="20">20 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Visit</Label>
            <Input
              id="reason"
              placeholder="e.g. Annual check-up, follow-up on blood work"
              {...register("reason")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes..."
              rows={2}
              {...register("notes")}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Scheduling..." : "Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Custom time picker — three small selects (hour / minute / period)
 * instead of the native <input type="time"> whose OS-rendered Set
 * button was getting clipped on some Android browsers (Manoj msg 876).
 * Value flows as a 24-hour "HH:MM" string so it round-trips with the
 * existing schema. Empty string = "no time picked" (defaults to 09:00
 * at submit per the new optional-time rule).
 */
function TimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  // Parse the current value (HH:MM in 24h) into 12h parts. Falls back
  // to 9:00 AM when empty so the dropdowns aren't blank.
  const parsed = parse24To12(value || "09:00");

  function emit(hour12: number, minute: number, period: "AM" | "PM") {
    const hour24 =
      period === "AM"
        ? hour12 === 12
          ? 0
          : hour12
        : hour12 === 12
          ? 12
          : hour12 + 12;
    const hh = String(hour24).padStart(2, "0");
    const mm = String(minute).padStart(2, "0");
    onChange(`${hh}:${mm}`);
  }

  return (
    <div className="flex items-center gap-1">
      <Select
        aria-label="Hour"
        value={String(parsed.hour12)}
        onChange={(e) =>
          emit(Number(e.target.value), parsed.minute, parsed.period)
        }
        className="w-16 px-2"
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </Select>
      <span className="text-muted-foreground">:</span>
      <Select
        aria-label="Minute"
        value={String(parsed.minute)}
        onChange={(e) =>
          emit(parsed.hour12, Number(e.target.value), parsed.period)
        }
        className="w-16 px-2"
      >
        {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
          <option key={m} value={m}>
            {String(m).padStart(2, "0")}
          </option>
        ))}
      </Select>
      <Select
        aria-label="AM or PM"
        value={parsed.period}
        onChange={(e) =>
          emit(parsed.hour12, parsed.minute, e.target.value as "AM" | "PM")
        }
        className="w-16 px-2"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </Select>
    </div>
  );
}

function parse24To12(hhmm: string): {
  hour12: number;
  minute: number;
  period: "AM" | "PM";
} {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  const h24 = m ? Math.min(23, Math.max(0, Number(m[1]))) : 9;
  const minute = m ? Math.min(59, Math.max(0, Number(m[2]))) : 0;
  const period = h24 >= 12 ? "PM" : "AM";
  const hour12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return { hour12, minute, period };
}

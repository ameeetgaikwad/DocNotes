import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { createPatientSchema, type CreatePatient } from "@docnotes/shared";
import { trpc, trpcClient } from "@/lib/trpc";
import { useDebounce } from "@/hooks/use-debounce";
import { formatPatientName } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

interface NewPatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewPatientDialog({
  open,
  onOpenChange,
}: NewPatientDialogProps) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<CreatePatient>({
    resolver: zodResolver(createPatientSchema),
    defaultValues: {
      firstName: "",
      middleName: null,
      lastName: "",
      gender: "male",
      email: null,
      phone: null,
      address: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      bloodType: null,
      notes: null,
    },
  });

  const firstName = watch("firstName");
  const middleName = watch("middleName");
  const lastName = watch("lastName");
  const dupQueryString = useMemo(
    () =>
      [firstName, middleName, lastName]
        .map((s) => (s ?? "").trim())
        .filter(Boolean)
        .join(" "),
    [firstName, middleName, lastName],
  );
  const debouncedDupQuery = useDebounce(dupQueryString, 300);
  const dupQuery = useQuery({
    ...trpc.patient.list.queryOptions({
      query: debouncedDupQuery || undefined,
      page: 1,
      limit: 5,
    }),
    enabled: open && debouncedDupQuery.length >= 2,
  });
  const duplicateCandidates = dupQuery.data?.items ?? [];

  const createMutation = useMutation({
    mutationFn: (data: CreatePatient) => trpcClient.patient.create.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["patient"]] });
      reset();
      setServerError(null);
      onOpenChange(false);
    },
    onError: (error) => {
      setServerError(error.message);
    },
  });

  const onSubmit = (data: CreatePatient) => {
    setServerError(null);
    createMutation.mutate(data);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      reset();
      setServerError(null);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Patient</DialogTitle>
          <DialogDescription>
            Add a new patient to your practice. Fields marked with * are
            required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {serverError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          {duplicateCandidates.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700/50 dark:bg-amber-950/30">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1">
                  <p className="font-medium text-amber-900 dark:text-amber-200">
                    Possible existing patient — check before creating a
                    duplicate.
                  </p>
                  <ul className="space-y-0.5">
                    {duplicateCandidates.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/patients/${p.id}`}
                          onClick={() => onOpenChange(false)}
                          className="text-amber-900 underline underline-offset-2 hover:text-amber-700 dark:text-amber-200 dark:hover:text-amber-100"
                        >
                          {formatPatientName(p)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Personal Information
            </h3>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  placeholder="First name"
                  {...register("firstName")}
                />
                {errors.firstName && (
                  <p className="text-xs text-destructive">
                    {errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="middleName">Middle Name</Label>
                <Input
                  id="middleName"
                  placeholder="Optional"
                  {...register("middleName", {
                    setValueAs: (v) => v || null,
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Surname *</Label>
                <Input
                  id="lastName"
                  placeholder="Surname"
                  {...register("lastName")}
                />
                {errors.lastName && (
                  <p className="text-xs text-destructive">
                    {errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                <Controller
                  control={control}
                  name="dateOfBirth"
                  render={({ field }) => {
                    const display =
                      field.value instanceof Date
                        ? `${field.value.getUTCFullYear()}-${String(
                            field.value.getUTCMonth() + 1,
                          ).padStart(2, "0")}-${String(
                            field.value.getUTCDate(),
                          ).padStart(2, "0")}`
                        : typeof field.value === "string"
                          ? field.value
                          : "";
                    return (
                      <DateInput
                        id="dateOfBirth"
                        value={display}
                        onChange={(v) =>
                          field.onChange(v ? new Date(v + "T00:00:00Z") : null)
                        }
                      />
                    );
                  }}
                />
                {errors.dateOfBirth && (
                  <p className="text-xs text-destructive">
                    {errors.dateOfBirth.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender *</Label>
                <Select id="gender" {...register("gender")}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </Select>
                {errors.gender && (
                  <p className="text-xs text-destructive">
                    {errors.gender.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bloodType">Blood Type</Label>
              <Select
                id="bloodType"
                {...register("bloodType", { setValueAs: (v) => v || null })}
              >
                <option value="">Select blood type</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Contact Information
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="patient@email.com"
                  {...register("email", { setValueAs: (v) => v || null })}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  {...register("phone", { setValueAs: (v) => v || null })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                placeholder="Full address"
                rows={2}
                {...register("address", { setValueAs: (v) => v || null })}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Emergency Contact
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="emergencyContactName">Contact Name</Label>
                <Input
                  id="emergencyContactName"
                  placeholder="Emergency contact"
                  {...register("emergencyContactName", {
                    setValueAs: (v) => v || null,
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyContactPhone">Contact Phone</Label>
                <Input
                  id="emergencyContactPhone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  {...register("emergencyContactPhone", {
                    setValueAs: (v) => v || null,
                  })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes about the patient..."
              rows={3}
              {...register("notes", { setValueAs: (v) => v || null })}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Patient"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

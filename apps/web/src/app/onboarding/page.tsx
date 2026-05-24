"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Stethoscope } from "lucide-react";
import { upsertDoctorProfileSchema } from "@docnotes/shared";
import { trpc, trpcClient } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormState = {
  fullName: string;
  dateOfBirth: string;
  qualification: string;
  specialization: string;
  clinicName: string;
  taluka: string;
  district: string;
  state: string;
  mobileNumber: string;
  email: string;
  registrationNumber: string;
};

const EMPTY: FormState = {
  fullName: "",
  dateOfBirth: "",
  qualification: "",
  specialization: "",
  clinicName: "",
  taluka: "",
  district: "",
  state: "",
  mobileNumber: "",
  email: "",
  registrationNumber: "",
};

export default function OnboardingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoaded: clerkLoaded } = useUser();

  const profileQuery = useQuery(trpc.doctorProfile.me.queryOptions());

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState, string>>
  >({});
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (profileQuery.data === null && form.email === "" && clerkLoaded) {
      const clerkEmail = user?.primaryEmailAddress?.emailAddress ?? "";
      if (clerkEmail) setForm((f) => ({ ...f, email: clerkEmail }));
    }
  }, [profileQuery.data, clerkLoaded, user, form.email]);

  useEffect(() => {
    if (profileQuery.data) {
      router.replace("/dashboard");
    }
  }, [profileQuery.data, router]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validated = useMemo(() => {
    const parsed = upsertDoctorProfileSchema.safeParse({
      fullName: form.fullName,
      dateOfBirth: form.dateOfBirth || null,
      qualification: form.qualification,
      specialization: form.specialization || null,
      clinicName: form.clinicName,
      taluka: form.taluka,
      district: form.district,
      state: form.state,
      mobileNumber: form.mobileNumber,
      email: form.email || null,
      registrationNumber: form.registrationNumber,
    });
    return parsed;
  }, [form]);

  const upsert = useMutation({
    mutationFn: async () => {
      if (!validated.success) {
        const fieldErrors: Partial<Record<keyof FormState, string>> = {};
        for (const issue of validated.error.issues) {
          const key = issue.path[0] as keyof FormState | undefined;
          if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
        }
        setErrors(fieldErrors);
        throw new Error("Please correct the highlighted fields.");
      }
      return trpcClient.doctorProfile.upsert.mutate(validated.data);
    },
    onSuccess: async (data) => {
      // Seed the cache so the Providers Shell doesn't read a stale `null`
      // and bounce us straight back to /onboarding while a refetch is in
      // flight. Then await invalidation so the next read is authoritative.
      if (data) {
        queryClient.setQueryData(trpc.doctorProfile.me.queryKey(), data);
      }
      await queryClient.invalidateQueries({
        queryKey: [["doctorProfile"]],
      });
      router.replace("/dashboard");
    },
    onError: (e) => {
      setServerError(e.message);
    },
  });

  if (profileQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Stethoscope className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold md:text-3xl">
            Let&apos;s set up your profile
          </h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-base">
            A few quick details so we can personalise your register and
            receipts.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setServerError(null);
            upsert.mutate();
          }}
          className="space-y-5 rounded-xl border bg-card p-5 sm:p-6"
        >
          {serverError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <Field
            label="Full Name"
            required
            error={errors.fullName}
            input={
              <Input
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                placeholder="Dr. Manoj Gaikwad"
                autoFocus
              />
            }
          />

          <Field
            label="Date of Birth"
            error={errors.dateOfBirth}
            input={
              <DateInput
                value={form.dateOfBirth}
                onChange={(v) => set("dateOfBirth", v)}
                max={new Date().toISOString().slice(0, 10)}
              />
            }
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Qualification"
              required
              error={errors.qualification}
              input={
                <Input
                  value={form.qualification}
                  onChange={(e) => set("qualification", e.target.value)}
                  placeholder="BAMS / BHMS / MBBS"
                />
              }
            />
            <Field
              label="Specialization"
              error={errors.specialization}
              input={
                <Input
                  value={form.specialization}
                  onChange={(e) => set("specialization", e.target.value)}
                  placeholder="Optional"
                />
              }
            />
          </div>

          <Field
            label="Clinic / Hospital Name"
            required
            error={errors.clinicName}
            input={
              <Input
                value={form.clinicName}
                onChange={(e) => set("clinicName", e.target.value)}
                placeholder="Gaikwad Clinic"
              />
            }
          />

          <div className="space-y-2">
            <Label className="md:text-base">Address *</Label>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                value={form.taluka}
                onChange={(e) => set("taluka", e.target.value)}
                placeholder="Taluka"
                aria-label="Taluka"
              />
              <Input
                value={form.district}
                onChange={(e) => set("district", e.target.value)}
                placeholder="District"
                aria-label="District"
              />
              <Input
                value={form.state}
                onChange={(e) => set("state", e.target.value)}
                placeholder="State"
                aria-label="State"
              />
            </div>
            {(errors.taluka || errors.district || errors.state) && (
              <p className="text-xs text-destructive md:text-sm">
                {errors.taluka || errors.district || errors.state}
              </p>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Mobile Number"
              required
              error={errors.mobileNumber}
              input={
                <Input
                  type="tel"
                  inputMode="numeric"
                  value={form.mobileNumber}
                  onChange={(e) => set("mobileNumber", e.target.value)}
                  placeholder="9876543210"
                />
              }
            />
            <Field
              label="Email"
              error={errors.email}
              input={
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="you@example.com"
                />
              }
            />
          </div>

          <Field
            label="Registration Number (Medical Council No.)"
            required
            error={errors.registrationNumber}
            input={
              <Input
                value={form.registrationNumber}
                onChange={(e) => set("registrationNumber", e.target.value)}
                placeholder="MMC / MCI registration"
              />
            }
          />

          <Button
            type="submit"
            disabled={upsert.isPending}
            className="w-full md:h-12 md:text-base"
          >
            {upsert.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin md:h-5 md:w-5" />{" "}
                Saving
              </>
            ) : (
              "Save & Continue"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  input,
}: {
  label: string;
  required?: boolean;
  error?: string;
  input: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="md:text-base">
        {label}
        {required && " *"}
      </Label>
      {input}
      {error && <p className="text-xs text-destructive md:text-sm">{error}</p>}
    </div>
  );
}

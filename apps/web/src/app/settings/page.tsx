"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stethoscope, Loader2, Pencil, Check, X } from "lucide-react";
import { trpc, trpcClient } from "@/lib/trpc";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MedicineDealersSection } from "@/components/settings/medicine-dealers-section";
import { ReminderTemplatesSection } from "@/components/settings/reminder-templates-section";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
      <p className="w-44 shrink-0 text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-medium md:text-base">{value}</p>
    </div>
  );
}

// Inline editor for the clinic name. Drives the dashboard title (Manoj
// msg 1441). The doctorProfile.upsert mutation requires the full
// profile payload, so we re-send all current fields with only
// clinicName changed.
function ClinicNameRow({
  profile,
}: {
  profile: {
    fullName: string;
    dateOfBirth: string | Date | null;
    qualification: string;
    specialization: string | null;
    clinicName: string;
    taluka: string;
    district: string;
    state: string;
    mobileNumber: string;
    email: string | null;
    registrationNumber: string;
  };
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(profile.clinicName);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(profile.clinicName);
  }, [profile.clinicName]);

  const save = useMutation({
    mutationFn: async () => {
      const trimmed = value.trim();
      if (!trimmed) throw new Error("Clinic name is required");
      // upsertDoctorProfileSchema's dateOfBirth wants YYYY-MM-DD; the
      // query gives us either a Date or an ISO string.
      const dobIso = !profile.dateOfBirth
        ? null
        : profile.dateOfBirth instanceof Date
          ? profile.dateOfBirth.toISOString().slice(0, 10)
          : profile.dateOfBirth.slice(0, 10);
      return trpcClient.doctorProfile.upsert.mutate({
        fullName: profile.fullName,
        dateOfBirth: dobIso,
        qualification: profile.qualification,
        specialization: profile.specialization,
        clinicName: trimmed,
        taluka: profile.taluka,
        district: profile.district,
        state: profile.state,
        mobileNumber: profile.mobileNumber,
        email: profile.email,
        registrationNumber: profile.registrationNumber,
      });
    },
    onSuccess: () => {
      setEditing(false);
      setError(null);
      queryClient.invalidateQueries({ queryKey: [["doctorProfile"]] });
    },
    onError: (e) => setError(e.message),
  });

  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
      <p className="w-44 shrink-0 text-sm text-muted-foreground">
        Name of the Clinic
      </p>
      {editing ? (
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. Samarth Clinic"
            maxLength={120}
            autoFocus
            className="h-9"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              {save.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setValue(profile.clinicName);
                setEditing(false);
                setError(null);
              }}
            >
              <X className="h-3 w-3" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center gap-2">
          <p className="text-sm font-medium md:text-base">
            {profile.clinicName}
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Edit clinic name"
            title="Edit clinic name"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {error && (
        <p className="text-xs text-destructive sm:basis-full sm:pl-[11rem]">
          {error}
        </p>
      )}
    </div>
  );
}

function OverdueThresholdSection({ current }: { current: number }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState<string>(String(current));
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setValue(String(current));
  }, [current]);

  const mutation = useMutation({
    mutationFn: (days: number) =>
      trpcClient.doctorProfile.updateOverdueThreshold.mutate({
        overdueDaysThreshold: days,
      }),
    onSuccess: () => {
      setError(null);
      setSavedAt(Date.now());
      queryClient.invalidateQueries({ queryKey: [["doctorProfile"]] });
      queryClient.invalidateQueries({ queryKey: [["dailyRegister"]] });
    },
    onError: (e) => setError(e.message),
  });

  const parsed = Number(value);
  const dirty = parsed !== current;
  const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 365;

  return (
    <div className="rounded-xl border bg-card p-6">
      <h2 className="mb-1 text-lg font-semibold">Actions Center</h2>
      <p className="mb-4 text-xs text-muted-foreground md:text-sm">
        How a patient&apos;s pending dues become an &ldquo;Overdue Call&rdquo;
        on the Actions page.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Label className="w-44 shrink-0 text-sm text-muted-foreground">
          Overdue after
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">days</span>
          {dirty && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (!valid) {
                  setError("Enter a whole number between 1 and 365");
                  return;
                }
                mutation.mutate(parsed);
              }}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> Saving
                </>
              ) : (
                "Save"
              )}
            </Button>
          )}
          {!dirty && savedAt && Date.now() - savedAt < 4000 && (
            <Check className="h-4 w-4 text-emerald-600" />
          )}
        </div>
      </div>
      {error && (
        <p className="mt-2 text-xs text-destructive sm:pl-[11rem]">{error}</p>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const profileQuery = useQuery(trpc.doctorProfile.me.queryOptions());
  const profile = profileQuery.data;

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and practice settings
        </p>
      </div>

      {profileQuery.isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!profileQuery.isLoading && !profile && (
        <div className="rounded-xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            Profile not set up yet.{" "}
            <Link href="/onboarding" className="text-primary hover:underline">
              Set it up now
            </Link>
            .
          </p>
        </div>
      )}

      {profile && (
        <div className="grid gap-6">
          <div className="rounded-xl border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Profile</h2>
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Stethoscope className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold md:text-xl">
                  {profile.fullName}
                </p>
                <p className="text-sm text-muted-foreground md:text-base">
                  {[profile.qualification, profile.specialization]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Row label="Mobile" value={profile.mobileNumber} />
              <Row label="Email" value={profile.email || "—"} />
              <Row
                label="Date of Birth"
                value={
                  profile.dateOfBirth ? formatDate(profile.dateOfBirth) : "—"
                }
              />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6">
            <h2 className="mb-1 text-lg font-semibold">Clinic Information</h2>
            <p className="mb-4 text-xs text-muted-foreground md:text-sm">
              The Name of the Clinic appears as the title on your home screen.
            </p>
            <div className="space-y-2">
              <ClinicNameRow profile={profile} />
              <Row
                label="Address"
                value={
                  <>
                    {profile.taluka}
                    {", "}
                    {profile.district}
                    {", "}
                    {profile.state}
                  </>
                }
              />
              <Row
                label="Registration No."
                value={profile.registrationNumber}
              />
            </div>
          </div>

          <OverdueThresholdSection
            current={profile.overdueDaysThreshold ?? 7}
          />

          <MedicineDealersSection />

          <ReminderTemplatesSection />
        </div>
      )}
    </div>
  );
}

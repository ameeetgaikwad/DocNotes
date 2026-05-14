"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Stethoscope, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/format";
import { MedicineDealersSection } from "@/components/settings/medicine-dealers-section";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
      <p className="w-44 shrink-0 text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-medium md:text-base">{value}</p>
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
            <h2 className="mb-4 text-lg font-semibold">Practice</h2>
            <div className="space-y-2">
              <Row label="Clinic / Hospital" value={profile.clinicName} />
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

          <MedicineDealersSection />
        </div>
      )}
    </div>
  );
}

"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ClipboardList,
  Receipt,
  Banknote,
  AlertCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatINR, formatRelative } from "@/lib/utils";
import { IntervalPicker, type Interval } from "@/components/IntervalPicker";
import { StatCard } from "@/components/StatCard";
import { TimeSeriesChart } from "@/components/TimeSeriesChart";

export default function DoctorDetailPage({
  params,
}: {
  params: Promise<{ doctorId: string }>;
}) {
  const { doctorId } = use(params);
  const [interval, setInterval] = useState<Interval>("30d");

  const doctor = useQuery(
    trpc.admin.doctorDetail.queryOptions({ userId: doctorId }),
  );
  const series = useQuery(
    trpc.admin.doctorActivitySeries.queryOptions({
      userId: doctorId,
      interval,
    }),
  );
  const topServices = useQuery(
    trpc.admin.doctorTopServices.queryOptions({ userId: doctorId }),
  );

  if (doctor.error) {
    return (
      <div className="space-y-4">
        <Link
          href="/doctors"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Doctors
        </Link>
        <div className="rounded-xl border bg-card p-8 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
          <p className="mt-3 font-medium">Could not load doctor</p>
          <p className="text-sm text-muted-foreground">
            {doctor.error.message}
          </p>
        </div>
      </div>
    );
  }

  const d = doctor.data;

  return (
    <div className="space-y-8">
      <Link
        href="/doctors"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Doctors
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {d?.fullName ?? "—"}
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          {d?.clinicName ?? "No clinic name"} · {d?.email ?? "—"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Signed up {formatRelative(d?.signupAt)} · Last active{" "}
          {formatRelative(d?.lastActive)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Patients"
          value={d?.patientCount ?? 0}
          icon={ClipboardList}
          isLoading={doctor.isLoading}
        />
        <StatCard
          label="Register entries"
          value={d?.registerEntryCount ?? 0}
          icon={Receipt}
          isLoading={doctor.isLoading}
        />
        <StatCard
          label="Total fees"
          value={formatINR(d?.totalRevenue ?? 0)}
          icon={Banknote}
          isLoading={doctor.isLoading}
        />
        <StatCard
          label="Outstanding dues"
          value={formatINR(d?.outstandingDues ?? 0)}
          icon={AlertCircle}
          isLoading={doctor.isLoading}
        />
      </div>

      <section className="space-y-3 rounded-xl border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold sm:text-lg">
            Register entries over time
          </h2>
          <IntervalPicker value={interval} onChange={setInterval} />
        </div>
        <TimeSeriesChart
          data={series.data ?? []}
          isLoading={series.isLoading}
          yLabel="entries"
        />
      </section>

      <section className="rounded-xl border bg-card p-4 sm:p-6">
        <h2 className="mb-4 text-base font-semibold sm:text-lg">
          Top services rendered
        </h2>
        {topServices.isLoading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {topServices.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No services yet.</p>
        )}
        {topServices.data && topServices.data.length > 0 && (
          <ul className="divide-y">
            {topServices.data.map((s) => (
              <li
                key={s.serviceType}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span>{s.serviceType}</span>
                <span className="font-medium tabular-nums">{s.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

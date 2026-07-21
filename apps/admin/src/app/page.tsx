"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, UserPlus, ClipboardList } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { IntervalPicker, type Interval } from "@/components/IntervalPicker";
import { StatCard } from "@/components/StatCard";
import { TimeSeriesChart } from "@/components/TimeSeriesChart";

export default function OverviewPage() {
  const [signupInterval, setSignupInterval] = useState<Interval>("30d");
  const [registerInterval, setRegisterInterval] = useState<Interval>("30d");

  const overview = useQuery(trpc.admin.overview.queryOptions());
  const signupsSeries = useQuery(
    trpc.admin.signupsSeries.queryOptions({ interval: signupInterval }),
  );
  const registerSeries = useQuery(
    trpc.admin.registerSeries.queryOptions({ interval: registerInterval }),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Overview
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Aggregate stats across every ClinikNote doctor.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Total doctors"
          value={overview.data?.totalDoctors ?? 0}
          icon={Users}
          isLoading={overview.isLoading}
        />
        <StatCard
          label="Signups (30d)"
          value={overview.data?.signups30d ?? 0}
          icon={UserPlus}
          isLoading={overview.isLoading}
        />
        <StatCard
          label="Total patients"
          value={overview.data?.totalPatients ?? 0}
          icon={ClipboardList}
          isLoading={overview.isLoading}
        />
      </div>

      <section className="space-y-3 rounded-xl border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold sm:text-lg">New signups</h2>
          <IntervalPicker value={signupInterval} onChange={setSignupInterval} />
        </div>
        <TimeSeriesChart
          data={signupsSeries.data ?? []}
          isLoading={signupsSeries.isLoading}
          yLabel="signups"
        />
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold sm:text-lg">
            Register entries
          </h2>
          <IntervalPicker
            value={registerInterval}
            onChange={setRegisterInterval}
          />
        </div>
        <TimeSeriesChart
          data={registerSeries.data ?? []}
          isLoading={registerSeries.isLoading}
          yLabel="entries"
        />
      </section>
    </div>
  );
}

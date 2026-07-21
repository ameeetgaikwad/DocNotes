"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatINR, formatRelative } from "@/lib/utils";

type SortKey =
  | "lastActive"
  | "signupAt"
  | "patientCount"
  | "revenue"
  | "clinic";

export default function DoctorsPage() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("lastActive");

  const doctorsQuery = useQuery(
    trpc.admin.doctorList.queryOptions({
      query: query.trim() || undefined,
      sort,
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Doctors
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          {doctorsQuery.data ? `${doctorsQuery.data.length} doctor(s)` : "—"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search clinic, doctor, email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-md border bg-card py-2 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <label className="text-xs text-muted-foreground">Sort by</label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-md border bg-card px-2 py-1.5 text-sm"
        >
          <option value="lastActive">Last active</option>
          <option value="signupAt">Signup date</option>
          <option value="patientCount">Patient count</option>
          <option value="revenue">Total fees</option>
          <option value="clinic">Clinic name</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Doctor</th>
              <th className="px-4 py-3">Clinic</th>
              <th className="px-4 py-3">Signup</th>
              <th className="px-4 py-3">Last active</th>
              <th className="px-4 py-3 text-right">Patients</th>
              <th className="px-4 py-3 text-right">Fees</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {doctorsQuery.isLoading && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Loading…
                </td>
              </tr>
            )}
            {doctorsQuery.data?.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No doctors match this filter.
                </td>
              </tr>
            )}
            {doctorsQuery.data?.map((d) => (
              <tr key={d.userId} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link
                    href={`/doctors/${d.userId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {d.fullName || "—"}
                  </Link>
                  <p className="text-xs text-muted-foreground">{d.email}</p>
                </td>
                <td className="px-4 py-3">{d.clinicName || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatRelative(d.signupAt)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatRelative(d.lastActive)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {d.patientCount}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatINR(d.totalRevenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

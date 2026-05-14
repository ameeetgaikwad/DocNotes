"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Users,
  ClipboardList,
  Activity,
  Loader2,
  Clock,
  Receipt,
  IndianRupee,
  AlertCircle,
  Wallet,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { todayLocalIsoDate, formatPatientName } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function StatCard({
  label,
  value,
  icon: Icon,
  isLoading,
  href,
  onClick,
  active,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  isLoading?: boolean;
  href?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const body = (
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
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-xl border bg-card p-6 transition hover:border-primary/40 hover:bg-accent/40"
      >
        {body}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-expanded={active}
        className={`block w-full rounded-xl border bg-card p-6 text-left transition hover:border-primary/40 hover:bg-accent/40 ${
          active ? "border-primary/60 bg-accent/30" : ""
        }`}
      >
        {body}
      </button>
    );
  }

  return <div className="rounded-xl border bg-card p-6">{body}</div>;
}

function formatTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function currentFinancialYear(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

function fyLabel(y: number): string {
  return `FY ${y}-${String(y + 1).slice(2)}`;
}

function fyRange(y: number): { startDate: string; endDate: string } {
  return { startDate: `${y}-04-01`, endDate: `${y + 1}-03-31` };
}

function thisMonthRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const mm = String(m + 1).padStart(2, "0");
  return {
    startDate: `${y}-${mm}-01`,
    endDate: `${y}-${mm}-${String(last).padStart(2, "0")}`,
  };
}

const typeLabels: Record<string, string> = {
  new_patient: "New Patient",
  follow_up: "Follow-up",
  routine: "Routine",
  urgent: "Urgent",
  telehealth: "Telehealth",
};

function MetricTile({
  label,
  value,
  icon: Icon,
  isLoading,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  isLoading?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-background p-4 md:p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      {isLoading ? (
        <Loader2 className="mt-2 h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <p className="mt-1 text-xl font-semibold md:text-2xl">{value}</p>
      )}
    </div>
  );
}

const HIGHLIGHT_THRESHOLD_KEY = "docnotes.pendingDues.highlightThreshold";
const HIGHLIGHT_DEFAULT = 1000;

function readStoredThreshold(): number {
  if (typeof window === "undefined") return HIGHLIGHT_DEFAULT;
  const v = window.localStorage.getItem(HIGHLIGHT_THRESHOLD_KEY);
  if (!v) return HIGHLIGHT_DEFAULT;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : HIGHLIGHT_DEFAULT;
}

function PendingDuesPanel() {
  const duesQuery = useQuery(trpc.dailyRegister.allPendingDues.queryOptions());
  const items = duesQuery.data ?? [];
  const total = items.reduce((acc, r) => acc + r.outstanding, 0);

  const [threshold, setThreshold] = useState<number>(HIGHLIGHT_DEFAULT);
  const [thresholdInput, setThresholdInput] = useState<string>(
    String(HIGHLIGHT_DEFAULT),
  );

  useEffect(() => {
    const v = readStoredThreshold();
    setThreshold(v);
    setThresholdInput(String(v));
  }, []);

  function commitThreshold(raw: string) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      setThresholdInput(String(threshold));
      return;
    }
    setThreshold(n);
    setThresholdInput(String(n));
    if (typeof window !== "undefined") {
      window.localStorage.setItem(HIGHLIGHT_THRESHOLD_KEY, String(n));
    }
  }

  const high = items.filter((r) => r.outstanding > threshold);
  const rest = items.filter((r) => r.outstanding <= threshold);

  return (
    <div className="mb-8 rounded-xl border bg-card">
      <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Pending Dues</h2>
        </div>
        {!duesQuery.isLoading && items.length > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {formatINR(total)}
            </span>{" "}
            outstanding across {items.length} patient
            {items.length === 1 ? "" : "s"}
          </p>
        )}
      </div>
      {!duesQuery.isLoading && items.length > 0 && (
        <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2 text-xs sm:px-6">
          <label
            htmlFor="dues-threshold"
            className="font-medium text-muted-foreground"
          >
            Highlight above ₹
          </label>
          <input
            id="dues-threshold"
            type="number"
            min="0"
            step="100"
            inputMode="numeric"
            value={thresholdInput}
            onChange={(e) => setThresholdInput(e.target.value)}
            onBlur={(e) => commitThreshold(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitThreshold((e.target as HTMLInputElement).value);
              }
            }}
            className="h-7 w-24 rounded border border-input bg-background px-2 text-right"
          />
        </div>
      )}
      {duesQuery.isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Wallet className="mb-3 h-10 w-10" />
          <p className="text-sm">No outstanding dues from any patient.</p>
        </div>
      ) : (
        <>
          {high.length > 0 && (
            <div>
              <p className="bg-amber-50 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-amber-800 sm:px-6 dark:bg-amber-950/40 dark:text-amber-200">
                Above {formatINR(threshold)} ({high.length})
              </p>
              <ul className="divide-y">
                {high.map((row) => (
                  <DueRow key={row.patientId} row={row} highlighted />
                ))}
              </ul>
            </div>
          )}
          {rest.length > 0 && (
            <div>
              {high.length > 0 && (
                <p className="bg-muted/30 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:px-6">
                  Other ({rest.length})
                </p>
              )}
              <ul className="divide-y">
                {rest.map((row) => (
                  <DueRow key={row.patientId} row={row} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DueRow({
  row,
  highlighted = false,
}: {
  row: {
    patientId: string;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    outstanding: number;
  };
  highlighted?: boolean;
}) {
  return (
    <li
      className={
        highlighted
          ? "flex items-center justify-between bg-amber-50/40 px-4 py-3 sm:px-6 dark:bg-amber-950/10"
          : "flex items-center justify-between px-4 py-3 sm:px-6"
      }
    >
      <Link
        href={`/patients/${row.patientId}#pending-dues`}
        className="text-sm font-medium text-primary hover:underline md:text-base"
      >
        {formatPatientName(row)}
      </Link>
      <span
        className={
          highlighted
            ? "font-mono text-sm font-semibold md:text-base"
            : "font-mono text-sm md:text-base"
        }
      >
        {formatINR(row.outstanding)}
      </span>
    </li>
  );
}

function RegisterSummaryPanel() {
  const [tab, setTab] = useState<"today" | "month" | "fy">("today");
  const currentFy = currentFinancialYear();
  const [fy, setFy] = useState<number | "">("");

  const range = useMemo<{ startDate: string; endDate: string } | null>(() => {
    if (tab === "today") {
      const d = todayLocalIsoDate();
      return { startDate: d, endDate: d };
    }
    if (tab === "month") return thisMonthRange();
    return fy === "" ? null : fyRange(Number(fy));
  }, [tab, fy]);

  const summaryQuery = useQuery({
    ...trpc.dailyRegister.summary.queryOptions(
      range ?? { startDate: "1970-01-01", endDate: "1970-01-01" },
    ),
    enabled: range !== null,
  });

  const fyOptions = useMemo(() => {
    const out: number[] = [];
    for (let y = currentFy; y >= currentFy - 4; y--) out.push(y);
    return out;
  }, [currentFy]);

  const metrics = (
    <div className="mt-4 grid gap-3 sm:grid-cols-3 md:gap-4">
      <MetricTile
        label="Total Cases"
        value={String(summaryQuery.data?.totalCases ?? 0)}
        icon={ClipboardList}
        isLoading={summaryQuery.isLoading && range !== null}
      />
      <MetricTile
        label="Receipts"
        value={formatINR(summaryQuery.data?.receipts ?? 0)}
        icon={IndianRupee}
        isLoading={summaryQuery.isLoading && range !== null}
      />
      <MetricTile
        label="Pending Dues"
        value={formatINR(summaryQuery.data?.pendingDues ?? 0)}
        icon={AlertCircle}
        isLoading={summaryQuery.isLoading && range !== null}
      />
    </div>
  );

  return (
    <div className="mb-8 rounded-xl border bg-card p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Register Summary</h2>
        <Link
          href="/daily-register"
          className="text-sm text-primary hover:underline"
        >
          Open register
        </Link>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "today" | "month" | "fy")}
      >
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="month">This Month</TabsTrigger>
          <TabsTrigger value="fy">F. Year</TabsTrigger>
        </TabsList>

        <TabsContent value="today">{metrics}</TabsContent>
        <TabsContent value="month">{metrics}</TabsContent>
        <TabsContent value="fy">
          <div className="mt-3 flex items-center gap-2">
            <label
              htmlFor="fy-select"
              className="text-sm font-medium text-muted-foreground"
            >
              Financial Year
            </label>
            <Select
              id="fy-select"
              value={fy === "" ? "" : String(fy)}
              onChange={(e) =>
                setFy(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="w-40"
            >
              <option value="">— Select FY —</option>
              {fyOptions.map((y) => (
                <option key={y} value={y}>
                  {fyLabel(y)}
                </option>
              ))}
            </Select>
          </div>
          {fy === "" ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Pick a financial year to see its summary.
            </p>
          ) : (
            metrics
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useQuery(trpc.dashboard.stats.queryOptions());
  const [registerSummaryOpen, setRegisterSummaryOpen] = useState(false);

  const todayIso = todayLocalIsoDate();
  const todayRegister = useQuery(
    trpc.dailyRegister.summary.queryOptions({
      startDate: todayIso,
      endDate: todayIso,
    }),
  );

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, Doctor</p>
      </div>

      <div
        className={
          registerSummaryOpen
            ? "mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            : "mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        }
      >
        <StatCard
          label="Today's Appointments"
          value={data?.todayAppointments ?? 0}
          icon={Calendar}
          isLoading={isLoading}
          href="/schedule"
        />
        <StatCard
          label="Total Patients"
          value={data?.totalPatients ?? 0}
          icon={Users}
          isLoading={isLoading}
          href="/patients"
        />
        <StatCard
          label="Register Summary"
          value={todayRegister.data?.totalCases ?? 0}
          icon={Receipt}
          isLoading={todayRegister.isLoading}
          active={registerSummaryOpen}
          onClick={() => setRegisterSummaryOpen((v) => !v)}
        />
        {!registerSummaryOpen && (
          <>
            <StatCard
              label="Pending Tasks"
              value="0"
              icon={ClipboardList}
              href="/tasks"
            />
            <StatCard
              label="Records This Week"
              value={data?.recordsThisWeek ?? 0}
              icon={Activity}
              isLoading={isLoading}
              href="/reports"
            />
          </>
        )}
      </div>

      {registerSummaryOpen && (
        <>
          <RegisterSummaryPanel />
          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Pending Tasks"
              value="0"
              icon={ClipboardList}
              href="/tasks"
            />
            <StatCard
              label="Records This Week"
              value={data?.recordsThisWeek ?? 0}
              icon={Activity}
              isLoading={isLoading}
              href="/reports"
            />
          </div>
        </>
      )}

      <PendingDuesPanel />

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
                href="/schedule"
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

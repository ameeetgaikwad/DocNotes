"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Users,
  ClipboardList,
  Loader2,
  Receipt,
  IndianRupee,
  AlertCircle,
  Wallet,
  Pencil,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { todayLocalIsoDate, formatPatientName, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  EditDailyRegisterEntryDialog,
  type RegisterEntryForEdit,
} from "@/components/daily-register/edit-entry-dialog";
import { WriteRxCallout } from "@/components/dashboard/write-rx-callout";

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

type PatientAggregate = {
  patientId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  total: number;
  oldestDate: string;
  entries: DueEntryRow[];
};

type ResponsiblePartyAggregate = {
  label: string;
  key: string;
  total: number;
  oldestDate: string;
  patients: PatientAggregate[];
};

function PendingDuesPanel() {
  const duesQuery = useQuery(trpc.dailyRegister.allPendingDues.queryOptions());
  const items = useMemo(() => duesQuery.data ?? [], [duesQuery.data]);
  const [editingEntry, setEditingEntry] = useState<RegisterEntryForEdit | null>(
    null,
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"summary" | "consolidated">("summary");

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

  const aggregates = useMemo<PatientAggregate[]>(() => {
    const byPatient = new Map<string, PatientAggregate>();
    for (const e of items) {
      const existing = byPatient.get(e.patientId);
      if (existing) {
        existing.total += e.outstanding;
        if (e.visitDate < existing.oldestDate)
          existing.oldestDate = e.visitDate;
        existing.entries.push(e);
      } else {
        byPatient.set(e.patientId, {
          patientId: e.patientId,
          firstName: e.firstName,
          middleName: e.middleName,
          lastName: e.lastName,
          total: e.outstanding,
          oldestDate: e.visitDate,
          entries: [e],
        });
      }
    }
    return Array.from(byPatient.values()).sort(
      (a, b) => b.total - a.total || a.lastName.localeCompare(b.lastName),
    );
  }, [items]);

  const total = aggregates.reduce((acc, a) => acc + a.total, 0);

  const { consolidated, consolidatedKeys } = useMemo<{
    consolidated: ResponsiblePartyAggregate[];
    consolidatedKeys: Set<string>;
  }>(() => {
    const byKey = new Map<string, ResponsiblePartyAggregate>();
    for (const a of aggregates) {
      const rawRp = a.entries[0]?.responsiblePartyName?.trim() ?? "";
      if (!rawRp) continue;
      const key = rawRp.toLowerCase();
      const existing = byKey.get(key);
      if (existing) {
        existing.total += a.total;
        if (a.oldestDate < existing.oldestDate)
          existing.oldestDate = a.oldestDate;
        existing.patients.push(a);
      } else {
        byKey.set(key, {
          label: rawRp,
          key,
          total: a.total,
          oldestDate: a.oldestDate,
          patients: [a],
        });
      }
    }
    // Manoj msg 2374: earlier we required 2+ patients under the same
    // responsible party before showing a group here. But even a single
    // patient with the field set — a doctor billing an elder relative
    // for one grandchild's care — belongs in Consolidated so the
    // pending-dues label reads the payer's name, not the patient's.
    // Drop the ≥ 2 gate.
    const groups: ResponsiblePartyAggregate[] = [];
    const keys = new Set<string>();
    for (const g of byKey.values()) {
      groups.push(g);
      keys.add(g.key);
    }
    groups.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
    return { consolidated: groups, consolidatedKeys: keys };
  }, [aggregates]);

  const summaryAggregates = useMemo(
    () =>
      aggregates.filter((a) => {
        const rp = a.entries[0]?.responsiblePartyName?.trim();
        return !rp || !consolidatedKeys.has(rp.toLowerCase());
      }),
    [aggregates, consolidatedKeys],
  );

  const summaryHigh = summaryAggregates.filter((a) => a.total > threshold);
  const summaryRest = summaryAggregates.filter((a) => a.total <= threshold);

  function toggleExpanded(patientId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(patientId)) next.delete(patientId);
      else next.add(patientId);
      return next;
    });
  }

  return (
    <div className="mb-8 rounded-xl border bg-card">
      <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Pending Dues</h2>
        </div>
        {!duesQuery.isLoading && aggregates.length > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {formatINR(total)}
            </span>{" "}
            outstanding across {aggregates.length}{" "}
            {aggregates.length === 1 ? "patient" : "patients"}
          </p>
        )}
      </div>

      <Tabs
        value={view}
        onValueChange={(v) => setView(v as "summary" | "consolidated")}
      >
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
          <TabsTrigger
            value="summary"
            className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-2 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Summary
          </TabsTrigger>
          <TabsTrigger
            value="consolidated"
            className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-2 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Consolidated
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="m-0">
          {!duesQuery.isLoading && aggregates.length > 0 && (
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
          ) : aggregates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Wallet className="mb-3 h-10 w-10" />
              <p className="text-sm">No outstanding dues from any patient.</p>
            </div>
          ) : summaryAggregates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Wallet className="mb-3 h-10 w-10" />
              <p className="text-sm">
                All outstanding dues are grouped under a Responsible Party — see
                the Consolidated tab.
              </p>
            </div>
          ) : (
            <>
              {summaryHigh.length > 0 && (
                <div>
                  <p className="bg-amber-50 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-amber-800 sm:px-6 dark:bg-amber-950/40 dark:text-amber-200">
                    Above {formatINR(threshold)} ({summaryHigh.length})
                  </p>
                  <ul className="divide-y">
                    {summaryHigh.map((agg) => (
                      <SummaryRow
                        key={agg.patientId}
                        agg={agg}
                        expanded={expanded.has(agg.patientId)}
                        onToggle={() => toggleExpanded(agg.patientId)}
                        onEditEntry={(e) => setEditingEntry(rowToEntry(e))}
                        highlighted
                      />
                    ))}
                  </ul>
                </div>
              )}
              {summaryRest.length > 0 && (
                <div>
                  {summaryHigh.length > 0 && (
                    <p className="bg-muted/30 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:px-6">
                      Other ({summaryRest.length})
                    </p>
                  )}
                  <ul className="divide-y">
                    {summaryRest.map((agg) => (
                      <SummaryRow
                        key={agg.patientId}
                        agg={agg}
                        expanded={expanded.has(agg.patientId)}
                        onToggle={() => toggleExpanded(agg.patientId)}
                        onEditEntry={(e) => setEditingEntry(rowToEntry(e))}
                      />
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="consolidated" className="m-0">
          {duesQuery.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : consolidated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Users className="mb-3 h-10 w-10" />
              <p className="text-sm font-medium">No consolidated groups yet</p>
              <p className="max-w-xs text-xs">
                Set a &ldquo;Responsible party&rdquo; on a patient (from their
                Summary card) — the payer&rsquo;s name will appear here instead
                of the patient&rsquo;s.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {consolidated.map((group) => (
                <ConsolidatedRow
                  key={group.key}
                  group={group}
                  expanded={expanded.has(group.key)}
                  onToggle={() => toggleExpanded(group.key)}
                  onEditEntry={(e) => setEditingEntry(rowToEntry(e))}
                />
              ))}
            </ul>
          )}
          <p className="border-t bg-muted/20 px-4 py-2 text-xs text-muted-foreground sm:px-6">
            Tip: set the &ldquo;Responsible party&rdquo; field on a
            patient&rsquo;s Summary card to roll their dues up to a head of
            family / employer / payer here. Patients without one show under
            their own name.
          </p>
        </TabsContent>
      </Tabs>

      <EditDailyRegisterEntryDialog
        open={editingEntry !== null}
        onOpenChange={(o) => !o && setEditingEntry(null)}
        entry={editingEntry}
      />
    </div>
  );
}

type DueEntryRow = {
  id: string;
  patientId: string;
  visitDate: string;
  serviceType: string | null;
  feeAmount: string | number | null;
  paymentMode: string | null;
  paymentStatus: string | null;
  feeReceivedAt: string | null;
  diagnosis: string | null;
  notes: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  responsiblePartyName: string | null;
  outstanding: number;
};

function rowToEntry(row: DueEntryRow): RegisterEntryForEdit {
  return {
    id: row.id,
    visitDate: row.visitDate,
    serviceType: row.serviceType,
    feeAmount: row.feeAmount,
    paymentMode: row.paymentMode,
    paymentStatus: row.paymentStatus,
    feeReceivedAt: row.feeReceivedAt,
    diagnosis: row.diagnosis,
    notes: row.notes,
    patient: {
      firstName: row.firstName,
      middleName: row.middleName,
      lastName: row.lastName,
    },
  };
}

function ConsolidatedRow({
  group,
  expanded,
  onToggle,
  onEditEntry,
}: {
  group: ResponsiblePartyAggregate;
  expanded: boolean;
  onToggle: () => void;
  onEditEntry: (entry: DueEntryRow) => void;
}) {
  const hasMultiplePatients = group.patients.length > 1;
  const totalEntries = group.patients.reduce(
    (acc, p) => acc + p.entries.length,
    0,
  );
  return (
    <li>
      <div className="flex items-center gap-2 px-4 py-3 sm:px-6">
        {hasMultiplePatients ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={
              expanded ? "Collapse linked patients" : "Expand linked patients"
            }
            className="-ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="w-7 shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium md:text-base">
            {group.label}
          </p>
          <p className="text-xs text-muted-foreground">
            {hasMultiplePatients
              ? `${group.patients.length} patients · ${totalEntries} ${totalEntries === 1 ? "entry" : "entries"} · oldest ${formatDate(group.oldestDate)}`
              : `${totalEntries} ${totalEntries === 1 ? "entry" : "entries"} · oldest ${formatDate(group.oldestDate)}`}
          </p>
        </div>
        <span className="font-mono text-sm md:text-base">
          {formatINR(group.total)}
        </span>
      </div>
      {expanded && hasMultiplePatients && (
        <ul className="divide-y border-t bg-muted/20">
          {group.patients.map((p) => (
            <li key={p.patientId} className="px-4 py-2 pl-12 sm:px-6 sm:pl-16">
              <div className="flex items-center gap-2">
                <Link
                  href={`/patients/${p.patientId}?tab=pending-dues`}
                  className="flex-1 truncate text-sm font-medium text-primary hover:underline"
                >
                  {formatPatientName(p)}
                </Link>
                <span className="font-mono text-sm">{formatINR(p.total)}</span>
              </div>
              <ul className="mt-1 space-y-1">
                {p.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <span className="flex-1">
                      {formatDate(entry.visitDate)}
                      {entry.diagnosis ? ` · ${entry.diagnosis}` : ""}
                    </span>
                    <span className="font-mono">
                      {formatINR(entry.outstanding)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onEditEntry(entry)}
                      aria-label="Edit fees for this entry"
                      title="Edit fees"
                      className="h-6 w-6"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function SummaryRow({
  agg,
  expanded,
  onToggle,
  onEditEntry,
  highlighted = false,
}: {
  agg: PatientAggregate;
  expanded: boolean;
  onToggle: () => void;
  onEditEntry: (entry: DueEntryRow) => void;
  highlighted?: boolean;
}) {
  const hasMultiple = agg.entries.length > 1;
  return (
    <li
      className={
        highlighted ? "bg-amber-50/40 dark:bg-amber-950/10" : undefined
      }
    >
      <div className="flex items-center gap-2 px-4 py-3 sm:px-6">
        {hasMultiple ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={expanded ? "Collapse entries" : "Expand entries"}
            className="-ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="w-7 shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <Link
            href={`/patients/${agg.patientId}?tab=pending-dues`}
            className="block truncate text-sm font-medium text-primary hover:underline md:text-base"
          >
            {formatPatientName(agg)}
          </Link>
          <p className="text-xs text-muted-foreground">
            {hasMultiple
              ? `${agg.entries.length} entries · oldest ${formatDate(agg.oldestDate)}`
              : formatDate(agg.oldestDate)}
          </p>
        </div>
        <span
          className={
            highlighted
              ? "font-mono text-sm font-semibold md:text-base"
              : "font-mono text-sm md:text-base"
          }
        >
          {formatINR(agg.total)}
        </span>
        {!hasMultiple && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onEditEntry(agg.entries[0]!)}
            aria-label="Edit fees for this entry"
            title="Edit fees"
            className="h-8 w-8"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>
      {expanded && hasMultiple && (
        <ul className="divide-y border-t bg-muted/20">
          {agg.entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-2 px-4 py-2 pl-12 sm:px-6 sm:pl-16"
            >
              <p className="flex-1 text-xs text-muted-foreground">
                {formatDate(entry.visitDate)}
                {entry.diagnosis ? ` · ${entry.diagnosis}` : ""}
              </p>
              <span className="font-mono text-sm">
                {formatINR(entry.outstanding)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onEditEntry(entry)}
                aria-label="Edit fees for this entry"
                title="Edit fees"
                className="h-7 w-7"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function RegisterSummaryPanel() {
  const [tab, setTab] = useState<"today" | "month" | "fy">("today");
  const currentFy = currentFinancialYear();
  const todayIso = todayLocalIsoDate();
  const currentMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  // Each tab gets a picker that defaults to its current period and lets
  // the doctor look back at older windows (Manoj msg 1414):
  //  - Today: date picker, today by default, max 30 days back
  //  - This Month: month picker, current month by default
  //  - Current F.Y.: FY dropdown, current FY by default (was required-select before)
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [fy, setFy] = useState<number>(currentFy);
  const thirtyDaysBack = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const range = useMemo<{ startDate: string; endDate: string }>(() => {
    if (tab === "today") {
      return { startDate: selectedDate, endDate: selectedDate };
    }
    if (tab === "month") {
      const [y, m] = selectedMonth.split("-").map(Number);
      const last = new Date(y, m, 0).getDate();
      return {
        startDate: `${selectedMonth}-01`,
        endDate: `${selectedMonth}-${String(last).padStart(2, "0")}`,
      };
    }
    return fyRange(fy);
  }, [tab, selectedDate, selectedMonth, fy]);

  const summaryQuery = useQuery(trpc.dailyRegister.summary.queryOptions(range));

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
        isLoading={summaryQuery.isLoading}
      />
      <MetricTile
        label="Receipts"
        value={formatINR(summaryQuery.data?.receipts ?? 0)}
        icon={IndianRupee}
        isLoading={summaryQuery.isLoading}
      />
      <MetricTile
        label="Pending Dues"
        value={formatINR(summaryQuery.data?.pendingDues ?? 0)}
        icon={AlertCircle}
        isLoading={summaryQuery.isLoading}
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
          <TabsTrigger value="fy">Current F.Y.</TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label
              htmlFor="today-date"
              className="text-sm font-medium text-muted-foreground"
            >
              Date
            </label>
            <input
              id="today-date"
              type="date"
              value={selectedDate}
              min={thirtyDaysBack}
              max={todayIso}
              onChange={(e) => setSelectedDate(e.target.value || todayIso)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
            {selectedDate !== todayIso && (
              <button
                type="button"
                onClick={() => setSelectedDate(todayIso)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Back to today
              </button>
            )}
          </div>
          {metrics}
        </TabsContent>

        <TabsContent value="month">
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label
              htmlFor="month-pick"
              className="text-sm font-medium text-muted-foreground"
            >
              Month
            </label>
            <input
              id="month-pick"
              type="month"
              value={selectedMonth}
              max={currentMonth}
              onChange={(e) => setSelectedMonth(e.target.value || currentMonth)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
            {selectedMonth !== currentMonth && (
              <button
                type="button"
                onClick={() => setSelectedMonth(currentMonth)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Back to this month
              </button>
            )}
          </div>
          {metrics}
        </TabsContent>

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
              value={String(fy)}
              onChange={(e) => setFy(Number(e.target.value))}
              className="w-44"
            >
              {fyOptions.map((y) => (
                <option key={y} value={y}>
                  {fyLabel(y)}
                  {y === currentFy ? " (current)" : ""}
                </option>
              ))}
            </Select>
          </div>
          {metrics}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function Dashboard() {
  const { data, isLoading } = useQuery(trpc.dashboard.stats.queryOptions());
  // Clinic name from the doctor's onboarding profile drives the title.
  // Falls back to "My Clinic" until profile loads or if the field is
  // blank (Manoj msg 1441 — personalised dashboard heading).
  const profileQuery = useQuery(trpc.doctorProfile.me.queryOptions());
  const clinicName = profileQuery.data?.clinicName?.trim() || "My Clinic";
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
        <h1 className="text-2xl font-semibold">{clinicName}</h1>
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
        {/* Total Patients dropped from Home per Manoj msg 2094 —
             count now surfaced at the top-right of the Patients list
             instead so the same info lives on the page it belongs to. */}
        <StatCard
          label="Register Summary"
          value={todayRegister.data?.totalCases ?? 0}
          icon={Receipt}
          isLoading={todayRegister.isLoading}
          active={registerSummaryOpen}
          onClick={() => setRegisterSummaryOpen((v) => !v)}
        />
        {!registerSummaryOpen && <WriteRxCallout />}
      </div>

      {registerSummaryOpen && (
        <>
          <RegisterSummaryPanel />
          <div className="mb-8">
            <WriteRxCallout />
          </div>
        </>
      )}

      <PendingDuesPanel />
    </div>
  );
}

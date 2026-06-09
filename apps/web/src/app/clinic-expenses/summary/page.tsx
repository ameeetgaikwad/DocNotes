"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatINR } from "@/lib/format";
import { Label } from "@/components/ui/label";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function ClinicExpensesSummaryPage() {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number | "year">(now.getMonth() + 1);

  const summaryQuery = useQuery(
    trpc.clinicExpense.summary.queryOptions({
      year,
      month: month === "year" ? undefined : month,
    }),
  );

  const yearOptions = useMemo(() => {
    const curr = new Date().getFullYear();
    return [curr + 1, curr, curr - 1, curr - 2, curr - 3];
  }, []);

  const data = summaryQuery.data;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-2 md:mb-8">
        <Link
          href="/clinic-expenses"
          className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Clinic Expenses
        </Link>
        <h1 className="text-2xl font-semibold md:text-3xl">Expense Summary</h1>
        <p className="text-sm text-muted-foreground md:text-base">
          Monthly or yearly breakdown by category, with paid vs unpaid totals.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3 sm:p-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="year" className="text-xs">
            Year
          </Label>
          <select
            id="year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="month" className="text-xs">
            Period
          </Label>
          <select
            id="month"
            value={month}
            onChange={(e) =>
              setMonth(
                e.target.value === "year" ? "year" : Number(e.target.value),
              )
            }
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="year">Whole year</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {summaryQuery.isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!summaryQuery.isLoading && data && (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4 sm:gap-4">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="mt-1 text-2xl font-semibold">
                {formatINR(data.grandTotal)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {data.grandCount} entries
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Paid
              </p>
              <p className="mt-1 text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
                {formatINR(data.grandPaid)}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Unpaid
              </p>
              <p className="mt-1 text-2xl font-semibold text-amber-700 dark:text-amber-300">
                {formatINR(data.grandUnpaid)}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Period</p>
              <p className="mt-1 text-sm font-medium">
                {month === "year"
                  ? `Jan – Dec ${year}`
                  : `${MONTHS[(month as number) - 1]} ${year}`}
              </p>
            </div>
          </div>

          {data.rows.length === 0 ? (
            <div className="rounded-xl border bg-card">
              <div className="flex flex-col items-center justify-center px-4 py-16 text-muted-foreground">
                <BarChart3 className="mb-3 h-12 w-12" />
                <p className="text-base font-medium">
                  No expenses in this period
                </p>
                <p className="mt-1 max-w-md text-center text-sm">
                  Try a different month or year, or head back and add some
                  expenses.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 text-right font-medium">Total</th>
                    <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">
                      Paid
                    </th>
                    <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">
                      Unpaid
                    </th>
                    <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">
                      Count
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.rows.map((row) => (
                    <tr key={row.categoryName}>
                      <td className="px-4 py-3">{row.categoryName}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatINR(row.total)}
                      </td>
                      <td className="hidden px-4 py-3 text-right text-emerald-700 dark:text-emerald-300 sm:table-cell">
                        {formatINR(row.paid)}
                      </td>
                      <td className="hidden px-4 py-3 text-right text-amber-700 dark:text-amber-300 sm:table-cell">
                        {formatINR(row.unpaid)}
                      </td>
                      <td className="hidden px-4 py-3 text-right text-muted-foreground sm:table-cell">
                        {row.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

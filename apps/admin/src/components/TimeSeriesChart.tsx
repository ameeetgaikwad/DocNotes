"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export interface SeriesPoint {
  bucket: string;
  count: number;
}

export function TimeSeriesChart({
  data,
  isLoading,
  yLabel,
}: {
  data: SeriesPoint[];
  isLoading?: boolean;
  yLabel: string;
}) {
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No data in this window.
      </div>
    );
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            stroke="hsl(214.3 31.8% 91.4%)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="bucket"
            tick={{ fontSize: 11, fill: "hsl(215.4 16.3% 46.9%)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "hsl(215.4 16.3% 46.9%)" }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "0.5rem",
              border: "1px solid hsl(214.3 31.8% 91.4%)",
              fontSize: "0.8rem",
            }}
            formatter={(v: number) => [v, yLabel]}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="hsl(172 85% 26%)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

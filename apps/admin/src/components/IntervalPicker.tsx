"use client";

export const INTERVALS = ["24h", "7d", "30d", "90d", "all"] as const;
export type Interval = (typeof INTERVALS)[number];

const LABELS: Record<Interval, string> = {
  "24h": "24h",
  "7d": "7d",
  "30d": "30d",
  "90d": "90d",
  all: "All",
};

export function IntervalPicker({
  value,
  onChange,
}: {
  value: Interval;
  onChange: (v: Interval) => void;
}) {
  return (
    <div className="inline-flex gap-0.5 rounded-md border bg-card p-0.5 text-xs">
      {INTERVALS.map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          className={`rounded-sm px-2.5 py-1 font-medium transition ${
            value === i
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent"
          }`}
        >
          {LABELS[i]}
        </button>
      ))}
    </div>
  );
}

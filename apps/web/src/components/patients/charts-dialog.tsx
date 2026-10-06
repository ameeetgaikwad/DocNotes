"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2, Plus, Trash2 } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { trpc, trpcClient } from "@/lib/trpc";
import { formatDate, todayLocalIsoDate } from "@/lib/format";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";
import { cn } from "@/lib/utils";

// Patient Charts (Amit msg 3051, spec Manoj msg 3054).
// BP / Sugar / Weight auto-pull from Clinical History vitals and are
// read-only here. Extra readings added in Charts never write back to
// vitals (one-way sync). Custom charts are doctor-wide.

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
}

type SugarType = "fasting" | "postprandial" | "random";
type SugarFilter = "all" | SugarType;
type Selected = "bp" | "sugar" | "weight" | { definitionId: string } | "new";

const SUGAR_LABEL: Record<SugarType, string> = {
  fasting: "Fasting",
  postprandial: "PP",
  random: "Random",
};

const COLORS = {
  primary: "#2563eb",
  secondary: "#db2777",
  tertiary: "#d97706",
  band: "#16a34a",
};

// Normal-range bands (Manoj msg 3054: "120/80 for BP, fasting under 100").
const SUGAR_BANDS: Record<SugarType, { min: number; max: number }> = {
  fasting: { min: 70, max: 100 },
  postprandial: { min: 70, max: 140 },
  random: { min: 70, max: 140 },
};

type Point = {
  key: string;
  date: string;
  label: string;
  source: "visit" | "chart";
  readingId?: string;
  a?: number | null;
  b?: number | null;
  c?: number | null;
};

function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

export function ChartsDialog({ open, onOpenChange, patientId }: Props) {
  const [selected, setSelected] = useState<Selected>("bp");
  const queryClient = useQueryClient();
  const query = useQuery({
    ...trpc.patientChart.forPatient.queryOptions({ patientId }),
    enabled: open,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: [["patientChart"]] });
  }

  const data = query.data;
  const definitions = data?.definitions ?? [];
  const selectedDef =
    typeof selected === "object"
      ? definitions.find((d) => d.id === selected.definitionId)
      : undefined;
  // A deleted custom chart falls back to BP.
  const effective: Selected =
    typeof selected === "object" && !selectedDef ? "bp" : selected;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Charts</DialogTitle>
        </DialogHeader>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Chip active={effective === "bp"} onClick={() => setSelected("bp")}>
            Blood Pressure
          </Chip>
          <Chip
            active={effective === "sugar"}
            onClick={() => setSelected("sugar")}
          >
            Blood Sugar
          </Chip>
          <Chip
            active={effective === "weight"}
            onClick={() => setSelected("weight")}
          >
            Weight
          </Chip>
          {definitions.map((d) => (
            <Chip
              key={d.id}
              active={
                typeof effective === "object" && effective.definitionId === d.id
              }
              onClick={() => setSelected({ definitionId: d.id })}
            >
              {d.name}
            </Chip>
          ))}
          <Chip
            active={effective === "new"}
            onClick={() => setSelected("new")}
            disabled={data ? !data.ready : true}
          >
            <Plus className="h-3.5 w-3.5" />
            New chart
          </Chip>
        </div>

        {query.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : query.error || !data ? (
          <div className="flex flex-col items-center py-8 text-muted-foreground">
            <AlertCircle className="mb-2 h-6 w-6 text-destructive/60" />
            <p className="text-sm">Couldn&apos;t load charts. Try again.</p>
          </div>
        ) : effective === "new" ? (
          <NewChartForm
            onCreated={(id) => {
              invalidate();
              setSelected({ definitionId: id });
            }}
          />
        ) : (
          <ChartPanel
            key={
              typeof effective === "object" ? effective.definitionId : effective
            }
            patientId={patientId}
            metric={effective}
            data={data}
            definition={selectedDef}
            onChanged={invalidate}
            onDefinitionDeleted={() => {
              invalidate();
              setSelected("bp");
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Chip({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-sm font-medium transition-colors disabled:opacity-50",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

type ChartData = Awaited<
  ReturnType<typeof trpcClient.patientChart.forPatient.query>
>;
type Definition = ChartData["definitions"][number];

function ChartPanel({
  patientId,
  metric,
  data,
  definition,
  onChanged,
  onDefinitionDeleted,
}: {
  patientId: string;
  metric: "bp" | "sugar" | "weight" | { definitionId: string };
  data: ChartData;
  definition?: Definition;
  onChanged: () => void;
  onDefinitionDeleted: () => void;
}) {
  const [sugarFilter, setSugarFilter] = useState<SugarFilter>("all");

  const points = useMemo<Point[]>(() => {
    const out: Point[] = [];
    if (metric === "bp") {
      for (const v of data.visits) {
        if (v.bpSystolic == null) continue;
        out.push({
          key: `v-${v.id}`,
          date: v.date,
          label: `${v.bpSystolic}/${v.bpDiastolic ?? "–"}`,
          source: "visit",
          a: v.bpSystolic,
          b: v.bpDiastolic,
        });
      }
      for (const r of data.readings) {
        if (r.metric !== "bp") continue;
        out.push({
          key: `r-${r.id}`,
          date: r.date,
          label: `${r.value}/${r.value2 ?? "–"}`,
          source: "chart",
          readingId: r.id,
          a: r.value,
          b: r.value2,
        });
      }
    } else if (metric === "sugar") {
      const slot = (t: SugarType) =>
        t === "fasting" ? "a" : t === "postprandial" ? "b" : "c";
      for (const v of data.visits) {
        const entries: [SugarType, number | null][] = [
          ["fasting", v.bslFasting],
          ["postprandial", v.bslPostprandial],
          ["random", v.bslRandom],
        ];
        for (const [t, val] of entries) {
          if (val == null) continue;
          if (sugarFilter !== "all" && sugarFilter !== t) continue;
          out.push({
            key: `v-${v.id}-${t}`,
            date: v.date,
            label: `${SUGAR_LABEL[t]} ${val} mg/dL`,
            source: "visit",
            [slot(t)]: val,
          });
        }
      }
      for (const r of data.readings) {
        if (r.metric !== "sugar" || !r.sugarType) continue;
        const t = r.sugarType as SugarType;
        if (sugarFilter !== "all" && sugarFilter !== t) continue;
        out.push({
          key: `r-${r.id}`,
          date: r.date,
          label: `${SUGAR_LABEL[t]} ${r.value} mg/dL`,
          source: "chart",
          readingId: r.id,
          [slot(t)]: r.value,
        });
      }
    } else if (metric === "weight") {
      for (const v of data.visits) {
        if (v.weightKg == null) continue;
        out.push({
          key: `v-${v.id}`,
          date: v.date,
          label: `${v.weightKg} kg`,
          source: "visit",
          a: v.weightKg,
        });
      }
      for (const r of data.readings) {
        if (r.metric !== "weight") continue;
        out.push({
          key: `r-${r.id}`,
          date: r.date,
          label: `${r.value} kg`,
          source: "chart",
          readingId: r.id,
          a: r.value,
        });
      }
    } else {
      for (const r of data.readings) {
        if (r.metric !== "custom" || r.definitionId !== metric.definitionId)
          continue;
        out.push({
          key: `r-${r.id}`,
          date: r.date,
          label: `${r.value}${definition?.unit ? ` ${definition.unit}` : ""}`,
          source: "chart",
          readingId: r.id,
          a: r.value,
        });
      }
    }
    return out.sort((x, y) => x.date.localeCompare(y.date));
  }, [metric, data, sugarFilter, definition]);

  const deleteReading = useMutation({
    mutationFn: (id: string) =>
      trpcClient.patientChart.deleteReading.mutate({ id }),
    onSuccess: onChanged,
  });
  const deleteDefinition = useMutation({
    mutationFn: (id: string) =>
      trpcClient.patientChart.deleteDefinition.mutate({ id }),
    onSuccess: onDefinitionDeleted,
  });

  const unit =
    metric === "bp"
      ? "mmHg"
      : metric === "sugar"
        ? "mg/dL"
        : metric === "weight"
          ? "kg"
          : (definition?.unit ?? "");

  return (
    <div className="space-y-4">
      {metric === "sugar" && (
        <div className="flex gap-1.5">
          {(["all", "fasting", "postprandial", "random"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setSugarFilter(f)}
              className={cn(
                "h-8 rounded-md border px-2.5 text-xs font-medium",
                sugarFilter === f
                  ? "border-primary bg-primary/10 text-primary"
                  : "hover:bg-accent",
              )}
            >
              {f === "all" ? "All" : SUGAR_LABEL[f]}
            </button>
          ))}
        </div>
      )}

      {points.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          No readings yet.
          {typeof metric !== "object" &&
            " Readings entered in Clinical History vitals will appear here automatically."}
        </div>
      ) : (
        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={points}
              margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
              <Tooltip
                labelFormatter={(d) => formatDate(String(d))}
                formatter={(value) => `${value} ${unit}`.trim()}
              />
              <Bands
                metric={metric}
                sugarFilter={sugarFilter}
                definition={definition}
              />
              {metric === "bp" && (
                <>
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    name="Systolic"
                    dataKey="a"
                    stroke={COLORS.primary}
                    strokeWidth={2}
                    connectNulls
                    dot={{ r: 3 }}
                  />
                  <Line
                    name="Diastolic"
                    dataKey="b"
                    stroke={COLORS.secondary}
                    strokeWidth={2}
                    connectNulls
                    dot={{ r: 3 }}
                  />
                </>
              )}
              {metric === "sugar" && (
                <>
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {(sugarFilter === "all" || sugarFilter === "fasting") && (
                    <Line
                      name="Fasting"
                      dataKey="a"
                      stroke={COLORS.primary}
                      strokeWidth={2}
                      connectNulls
                      dot={{ r: 3 }}
                    />
                  )}
                  {(sugarFilter === "all" ||
                    sugarFilter === "postprandial") && (
                    <Line
                      name="PP"
                      dataKey="b"
                      stroke={COLORS.secondary}
                      strokeWidth={2}
                      connectNulls
                      dot={{ r: 3 }}
                    />
                  )}
                  {(sugarFilter === "all" || sugarFilter === "random") && (
                    <Line
                      name="Random"
                      dataKey="c"
                      stroke={COLORS.tertiary}
                      strokeWidth={2}
                      connectNulls
                      dot={{ r: 3 }}
                    />
                  )}
                </>
              )}
              {(metric === "weight" || typeof metric === "object") && (
                <Line
                  name={
                    metric === "weight" ? "Weight" : (definition?.name ?? "")
                  }
                  dataKey="a"
                  stroke={COLORS.primary}
                  strokeWidth={2}
                  connectNulls
                  dot={{ r: 3 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <BandCaption
        metric={metric}
        sugarFilter={sugarFilter}
        definition={definition}
      />

      <AddReadingForm
        patientId={patientId}
        metric={metric}
        unit={unit}
        defaultSugarType={sugarFilter === "all" ? "fasting" : sugarFilter}
        onAdded={onChanged}
      />

      {points.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Readings
          </p>
          <ul className="divide-y rounded-lg border">
            {[...points].reverse().map((p) => (
              <li
                key={p.key}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span className="tabular-nums">{formatDate(p.date)}</span>
                <span className="flex-1 font-medium tabular-nums">
                  {p.label}
                  {metric === "bp" && " mmHg"}
                </span>
                {p.source === "visit" ? (
                  <span className="text-xs text-muted-foreground">
                    From vitals
                  </span>
                ) : (
                  <button
                    type="button"
                    aria-label="Delete reading"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive disabled:opacity-50"
                    disabled={deleteReading.isPending}
                    onClick={() => {
                      if (window.confirm("Delete this reading?")) {
                        deleteReading.mutate(p.readingId!);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {typeof metric !== "object" && (
            <p className="text-xs text-muted-foreground">
              Readings from vitals can be edited in Clinical History.
            </p>
          )}
        </div>
      )}

      {definition && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            disabled={deleteDefinition.isPending}
            onClick={() => {
              if (
                window.confirm(
                  `Delete the "${definition.name}" chart? It will be removed for all patients.`,
                )
              ) {
                deleteDefinition.mutate(definition.id);
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete chart
          </Button>
        </div>
      )}
    </div>
  );
}

function Bands({
  metric,
  sugarFilter,
  definition,
}: {
  metric: "bp" | "sugar" | "weight" | { definitionId: string };
  sugarFilter: SugarFilter;
  definition?: Definition;
}) {
  if (metric === "bp") {
    return (
      <>
        <ReferenceLine y={120} stroke={COLORS.band} strokeDasharray="4 4" />
        <ReferenceLine y={80} stroke={COLORS.band} strokeDasharray="4 4" />
      </>
    );
  }
  if (metric === "sugar") {
    if (sugarFilter === "all") {
      return (
        <>
          <ReferenceLine y={100} stroke={COLORS.band} strokeDasharray="4 4" />
          <ReferenceLine y={140} stroke={COLORS.band} strokeDasharray="4 4" />
        </>
      );
    }
    const band = SUGAR_BANDS[sugarFilter];
    return (
      <ReferenceArea
        y1={band.min}
        y2={band.max}
        fill={COLORS.band}
        fillOpacity={0.1}
        ifOverflow="extendDomain"
      />
    );
  }
  if (
    definition &&
    (definition.normalMin != null || definition.normalMax != null)
  ) {
    if (definition.normalMin != null && definition.normalMax != null) {
      return (
        <ReferenceArea
          y1={definition.normalMin}
          y2={definition.normalMax}
          fill={COLORS.band}
          fillOpacity={0.1}
          ifOverflow="extendDomain"
        />
      );
    }
    return (
      <ReferenceLine
        y={(definition.normalMin ?? definition.normalMax)!}
        stroke={COLORS.band}
        strokeDasharray="4 4"
      />
    );
  }
  return null;
}

function BandCaption({
  metric,
  sugarFilter,
  definition,
}: {
  metric: "bp" | "sugar" | "weight" | { definitionId: string };
  sugarFilter: SugarFilter;
  definition?: Definition;
}) {
  let text: string | null = null;
  if (metric === "bp") text = "Normal: below 120/80 mmHg";
  else if (metric === "sugar") {
    text =
      sugarFilter === "all"
        ? "Normal: fasting below 100, PP / random below 140 mg/dL"
        : sugarFilter === "fasting"
          ? "Normal fasting: 70–100 mg/dL"
          : `Normal ${SUGAR_LABEL[sugarFilter]}: below 140 mg/dL`;
  } else if (definition) {
    const u = definition.unit ? ` ${definition.unit}` : "";
    if (definition.normalMin != null && definition.normalMax != null)
      text = `Normal: ${definition.normalMin}–${definition.normalMax}${u}`;
    else if (definition.normalMax != null)
      text = `Normal: below ${definition.normalMax}${u}`;
    else if (definition.normalMin != null)
      text = `Normal: above ${definition.normalMin}${u}`;
  }
  if (!text) return null;
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <span
        className="inline-block h-0.5 w-4 border-t-2 border-dashed"
        style={{ borderColor: COLORS.band }}
      />
      {text}
    </p>
  );
}

function parseNum(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function AddReadingForm({
  patientId,
  metric,
  unit,
  defaultSugarType,
  onAdded,
}: {
  patientId: string;
  metric: "bp" | "sugar" | "weight" | { definitionId: string };
  unit: string;
  defaultSugarType: SugarType;
  onAdded: () => void;
}) {
  const [date, setDate] = useState(todayLocalIsoDate());
  const [value, setValue] = useState("");
  const [value2, setValue2] = useState("");
  const [sugarType, setSugarType] = useState<SugarType>(defaultSugarType);
  const [error, setError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: () => {
      const v = parseNum(value);
      const v2 = parseNum(value2);
      if (v == null) throw new Error("Enter a value");
      if (metric === "bp" && v2 == null)
        throw new Error("Enter both systolic and diastolic");
      if (!date) throw new Error("Pick a date");
      return trpcClient.patientChart.addReading.mutate({
        patientId,
        metric: typeof metric === "object" ? "custom" : metric,
        definitionId:
          typeof metric === "object" ? metric.definitionId : undefined,
        readingDate: date,
        value: v,
        value2: metric === "bp" ? (v2 ?? undefined) : undefined,
        sugarType: metric === "sugar" ? sugarType : undefined,
      });
    },
    onSuccess: () => {
      setValue("");
      setValue2("");
      setError(null);
      onAdded();
    },
    onError: (err) => setError(err.message),
  });

  return (
    <form
      className="space-y-2 rounded-lg border bg-muted/30 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate();
      }}
    >
      <p className="text-sm font-medium">Add reading</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-32">
          <Label className="text-xs" htmlFor="chart-reading-date">
            Date
          </Label>
          <DateInput
            id="chart-reading-date"
            value={date}
            onChange={setDate}
            max={todayLocalIsoDate()}
          />
        </div>
        {metric === "sugar" && (
          <div className="w-28">
            <Label className="text-xs" htmlFor="chart-sugar-type">
              Type
            </Label>
            <Select
              id="chart-sugar-type"
              value={sugarType}
              onChange={(e) => setSugarType(e.target.value as SugarType)}
            >
              <option value="fasting">Fasting</option>
              <option value="postprandial">PP</option>
              <option value="random">Random</option>
            </Select>
          </div>
        )}
        <div className="w-24">
          <Label className="text-xs" htmlFor="chart-value">
            {metric === "bp" ? "Systolic" : `Value${unit ? ` (${unit})` : ""}`}
          </Label>
          <Input
            id="chart-value"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        {metric === "bp" && (
          <div className="w-24">
            <Label className="text-xs" htmlFor="chart-value2">
              Diastolic
            </Label>
            <Input
              id="chart-value2"
              inputMode="numeric"
              value={value2}
              onChange={(e) => setValue2(e.target.value)}
            />
          </div>
        )}
        <Button type="submit" className="h-11" disabled={add.isPending}>
          {add.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Add
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}

function NewChartForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [normalMin, setNormalMin] = useState("");
  const [normalMax, setNormalMax] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => {
      if (!name.trim()) throw new Error("Enter a chart name");
      const min = parseNum(normalMin);
      const max = parseNum(normalMax);
      if (min != null && max != null && min > max)
        throw new Error("Normal min must be below normal max");
      return trpcClient.patientChart.upsertDefinition.mutate({
        name: name.trim(),
        unit: unit.trim() || null,
        normalMin: min,
        normalMax: max,
      });
    },
    onSuccess: (created) => {
      if (created) onCreated(created.id);
    },
    onError: (err) => setError(err.message),
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      <p className="text-sm text-muted-foreground">
        A new chart is available for all your patients.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <Label htmlFor="chart-name">Chart name</Label>
          <Input
            id="chart-name"
            placeholder="e.g. Creatinine"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <Label htmlFor="chart-unit">Unit (optional)</Label>
          <Input
            id="chart-unit"
            placeholder="e.g. mg/dL"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            maxLength={30}
          />
        </div>
        <div>
          <Label htmlFor="chart-min">Normal from (optional)</Label>
          <Input
            id="chart-min"
            inputMode="decimal"
            placeholder="e.g. 0.6"
            value={normalMin}
            onChange={(e) => setNormalMin(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="chart-max">Normal to (optional)</Label>
          <Input
            id="chart-max"
            inputMode="decimal"
            placeholder="e.g. 1.2"
            value={normalMax}
            onChange={(e) => setNormalMax(e.target.value)}
          />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={create.isPending}>
        {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Create chart
      </Button>
    </form>
  );
}

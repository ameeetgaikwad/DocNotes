"use client";

import { useState, useMemo } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CalendarInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  max?: string;
  min?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
}

function toDdMmYyyy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function isoFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateFromIso(iso: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function CalendarInput({
  id,
  value,
  onChange,
  onFocus,
  max,
  min,
  disabled,
  className,
  placeholder = "DD/MM/YYYY",
  ...rest
}: CalendarInputProps) {
  const [open, setOpen] = useState(false);
  const display = toDdMmYyyy(value);

  const selected = useMemo(() => dateFromIso(value), [value]);
  const fromDate = useMemo(() => dateFromIso(min ?? ""), [min]);
  const toDate = useMemo(() => dateFromIso(max ?? ""), [max]);
  // Navigation bounds for the calendar UI — broader than the explicit
  // min/max selection bounds so the captionLayout="dropdown" picker
  // gives the doctor a useful range. Without these the dropdown shows
  // only the current year by default. Selection is still gated by the
  // `disabled` callback below, so being able to NAVIGATE further back
  // doesn't let you PICK a date outside an explicit min/max.
  const navStartMonth = useMemo(() => {
    if (fromDate) return fromDate;
    const d = new Date();
    d.setFullYear(d.getFullYear() - 10);
    return d;
  }, [fromDate]);
  const navEndMonth = useMemo(() => {
    if (toDate) return toDate;
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d;
  }, [toDate]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) onFocus?.();
      }}
    >
      <PopoverTrigger asChild disabled={disabled}>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-label={rest["aria-label"]}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className={cn(!display && "text-muted-foreground")}>
            {display || placeholder}
          </span>
          <CalendarIcon
            className="ml-2 h-4 w-4 text-muted-foreground"
            aria-hidden
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? new Date()}
          startMonth={navStartMonth}
          endMonth={navEndMonth}
          disabled={
            fromDate || toDate
              ? (day: Date) => {
                  if (fromDate && day < fromDate) return true;
                  if (toDate && day > toDate) return true;
                  return false;
                }
              : undefined
          }
          onSelect={(d: Date | undefined) => {
            if (d) {
              onChange(isoFromDate(d));
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

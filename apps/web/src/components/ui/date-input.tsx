"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface DateInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  max?: string;
  min?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

function toDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function parseDisplay(display: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display.trim());
  if (!m) return null;
  const dd = m[1] as string;
  const mm = m[2] as string;
  const yyyy = m[3] as string;
  const d = Number(dd);
  const mo = Number(mm);
  const y = Number(yyyy);
  if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 1900 || y > 2100) return null;
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== mo - 1 ||
    probe.getUTCDate() !== d
  ) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}

function autoFormat(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function DateInput({
  id,
  value,
  onChange,
  max,
  min,
  disabled,
  className,
  ...rest
}: DateInputProps) {
  const [text, setText] = React.useState<string>(() => toDisplay(value));

  React.useEffect(() => {
    setText(toDisplay(value));
  }, [value]);

  const commit = (next: string) => {
    if (next === "") {
      onChange("");
      return;
    }
    const iso = parseDisplay(next);
    if (!iso) {
      setText(toDisplay(value));
      return;
    }
    if (max && iso > max) {
      setText(toDisplay(value));
      return;
    }
    if (min && iso < min) {
      setText(toDisplay(value));
      return;
    }
    onChange(iso);
    setText(toDisplay(iso));
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="DD/MM/YYYY"
      disabled={disabled}
      value={text}
      onChange={(e) => setText(autoFormat(e.target.value))}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit((e.target as HTMLInputElement).value);
        }
      }}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...rest}
    />
  );
}

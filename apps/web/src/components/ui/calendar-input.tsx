"use client";

import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const display = toDdMmYyyy(value);

  return (
    <div
      className={cn(
        "relative flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span className={cn(!display && "text-muted-foreground")}>
        {display || placeholder}
      </span>
      <CalendarIcon
        className="pointer-events-none ml-auto h-4 w-4 text-muted-foreground"
        aria-hidden
      />
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        max={max}
        min={min}
        disabled={disabled}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        aria-label={rest["aria-label"]}
      />
    </div>
  );
}

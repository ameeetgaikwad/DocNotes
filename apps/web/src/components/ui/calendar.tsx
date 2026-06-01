"use client";

import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { cn } from "@/lib/utils";

type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({
  className,
  captionLayout,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      // Default to dropdown layout for month/year — mobile-friendly,
      // doctors can tap to switch months without relying on tiny nav
      // arrows that can fall off-screen in narrow popovers (Manoj msg
      // 1396 couldn't reach previous month on the Daily Register
      // filter). Callers can still override with captionLayout="label".
      captionLayout={captionLayout ?? "dropdown"}
      className={cn("rdp-root", className)}
      {...props}
    />
  );
}

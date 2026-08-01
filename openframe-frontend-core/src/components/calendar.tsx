"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "../utils/cn"
import { buttonVariants } from "./ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

/**
 * ODS-styled DayPicker wrapper.
 *
 * IMPORTANT: the installed react-day-picker is **v9** — the classNames keys
 * below are the v9 vocabulary (`weekdays`/`weekday`/`week`/`day`/`day_button`/
 * `selected`/`disabled`/…). The previous v8 shadcn map (`head_row`, `cell`,
 * `day_selected`, …) was silently IGNORED by v9, which shipped default
 * browser-table chrome: misaligned weekday headers, no disabled styling,
 * wrapping rows on mobile. Do not reintroduce v8 keys.
 *
 * Day-cell display stays `table-cell` (only the inner `day_button` is
 * flex) — converting `<td>`s to inline-flex is what made rows wrap.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "relative flex flex-col md:flex-row gap-[var(--spacing-system-mf)]",
        month: "flex flex-col gap-[var(--spacing-system-s)]",
        nav: "absolute inset-x-0 top-0 z-10 flex h-8 items-center justify-between",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 bg-transparent p-0 opacity-60 hover:opacity-100 disabled:opacity-25"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 bg-transparent p-0 opacity-60 hover:opacity-100 disabled:opacity-25"
        ),
        month_caption: "flex h-8 items-center justify-center",
        caption_label: "text-h6 text-ods-text-primary",
        month_grid: "border-separate border-spacing-y-1",
        weekdays: "",
        weekday: "h-9 w-9 p-0 text-center align-middle text-h6 font-normal text-ods-text-secondary",
        week: "",
        day: "h-9 w-9 p-0 text-center align-middle",
        day_button: cn(
          buttonVariants({ variant: "transparent" }),
          "h-9 w-9 rounded-md p-0 font-normal text-ods-text-primary"
        ),
        selected:
          "[&>button]:bg-ods-accent [&>button]:text-ods-text-on-accent [&>button]:hover:bg-ods-accent",
        today: "[&>button]:text-ods-accent [&[aria-selected]>button]:text-ods-text-on-accent",
        outside: "[&>button]:text-ods-text-muted [&>button]:opacity-50",
        disabled: "[&>button]:text-ods-text-muted [&>button]:opacity-40 [&>button]:hover:bg-transparent",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName }) =>
          orientation === "right" ? (
            <ChevronRight className={cn("h-4 w-4", chevronClassName)} />
          ) : (
            <ChevronLeft className={cn("h-4 w-4", chevronClassName)} />
          ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }

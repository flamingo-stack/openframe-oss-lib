"use client"

import * as React from "react"
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react"
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
        // size 'icon-sm' = the lib's fixed 32px icon button (no md: growth —
        // the DEFAULT size carries `md:h-12`, which tailwind-merge does NOT
        // drop for a plain `h-8` override and the nav ballooned on desktop).
        // Boundary-month nav state arrives as BOTH native `disabled` and
        // `aria-disabled` depending on the react-day-picker code path — style
        // both (the same pairing buttonSurfaceClasses uses).
        button_previous: cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "bg-transparent opacity-60 hover:opacity-100 disabled:opacity-25 aria-disabled:opacity-25 aria-disabled:pointer-events-none"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "bg-transparent opacity-60 hover:opacity-100 disabled:opacity-25 aria-disabled:opacity-25 aria-disabled:pointer-events-none"
        ),
        month_caption: "flex h-8 items-center justify-center",
        caption_label: "text-h6 text-ods-text-primary",
        month_grid: "border-separate border-spacing-y-1",
        weekdays: "",
        weekday: "h-9 w-9 p-0 text-center align-middle text-h6 font-normal text-ods-text-secondary",
        week: "",
        day: "h-9 w-9 p-0 text-center align-middle",
        // 'icon-sm' again: a size MUST be passed or the default's `md:h-12` +
        // `text-h3` leak through and inflate day cells on desktop.
        day_button: cn(
          buttonVariants({ variant: "transparent", size: "icon-sm" }),
          "h-9 w-9 rounded-md p-0 text-h6 font-normal text-ods-text-primary"
        ),
        selected:
          "[&>button]:bg-ods-accent [&>button]:text-ods-text-on-accent [&>button]:hover:bg-ods-accent",
        today: "[&>button]:text-ods-accent [&[aria-selected]>button]:text-ods-text-on-accent",
        outside: "[&>button]:text-ods-text-muted [&>button]:opacity-50",
        // `cursor-not-allowed` on the CELL, not the button: the day button is a
        // core `Button`, whose disabled state carries `pointer-events-none`, so
        // a cursor set on it never applies — the pointer is over the cell.
        disabled:
          "cursor-not-allowed [&>button]:text-ods-text-muted [&>button]:opacity-40 [&>button]:hover:bg-transparent",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        // v9 passes 'up'/'down' for dropdown captions too — branch all four.
        Chevron: ({ orientation, className: chevronClassName }) => {
          const cls = cn("h-4 w-4", chevronClassName)
          if (orientation === "right") return <ChevronRight className={cls} />
          if (orientation === "up") return <ChevronUp className={cls} />
          if (orientation === "down") return <ChevronDown className={cls} />
          return <ChevronLeft className={cls} />
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }

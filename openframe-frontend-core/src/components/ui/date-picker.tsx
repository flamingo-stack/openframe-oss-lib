"use client";

import * as Popover from "@radix-ui/react-popover";
import { ArrowUpDown, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import {
  DayPicker,
  type DateRange,
  type DayPickerProps,
} from "react-day-picker";
import { useMdUp } from "../../hooks";
import { cn } from "../../utils/cn";
import { Button } from "./button";
import { FieldWrapper } from "./field-wrapper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import type { SortDirection } from "./sort-column-item";

// ============================================================================
// Types
// ============================================================================

export type DatePickerMode = "single" | "range";

export interface DatePickerBaseProps {
  /** Placeholder text when no date is selected */
  placeholder?: string;
  /** Format function for displaying the date */
  formatDate?: (date: Date) => string;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Additional class name for the trigger button */
  className?: string;
  /** Number of months to display */
  numberOfMonths?: 1 | 2;
  /** Minimum selectable date */
  fromDate?: Date;
  /** Maximum selectable date */
  toDate?: Date;
  /** Locale for formatting */
  locale?: DayPickerProps["locale"];
  /** Label text displayed above the picker */
  label?: string;
  /** Error message displayed below the picker */
  error?: string;
  /** When true, renders red error border */
  invalid?: boolean;
}

export interface SingleDatePickerProps extends DatePickerBaseProps {
  mode: "single";
  value?: Date;
  onChange?: (date: Date | undefined) => void;
}

export interface RangeDatePickerProps extends DatePickerBaseProps {
  mode: "range";
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
}

export type DatePickerProps = SingleDatePickerProps | RangeDatePickerProps;

// ============================================================================
// Helper functions
// ============================================================================

const defaultFormatDate = (date: Date): string => {
  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
};

const formatDateRange = (
  range: DateRange | undefined,
  formatFn: (date: Date) => string
): string => {
  if (!range?.from) return "";
  if (!range.to) return formatFn(range.from);
  return `${formatFn(range.from)} - ${formatFn(range.to)}`;
};

// ============================================================================
// Calendar Components
// ============================================================================

interface CalendarNavButtonProps {
  direction: "left" | "right";
  onClick?: () => void;
  "aria-label"?: string;
}

function CalendarNavButton({ direction, onClick, "aria-label": ariaLabel }: CalendarNavButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={onClick}
      aria-label={ariaLabel}
      leftIcon={direction === "left" ? <ChevronLeft className="size-6" /> : <ChevronRight className="size-6" />}
    />
  );
}

// ============================================================================
// DatePickerCalendar Component
// ============================================================================

interface DatePickerCalendarProps {
  mode: DatePickerMode;
  selected: Date | DateRange | undefined;
  onSelect: (value: Date | DateRange | undefined) => void;
  numberOfMonths?: 1 | 2;
  fromDate?: Date;
  toDate?: Date;
  locale?: DayPickerProps["locale"];
  /**
   * When true the calendar fills its container width and day cells flex to
   * fit (instead of the fixed 40px cells). Used by DateFilterMenu so the grid
   * lines up with the surrounding controls per the Figma filter-menu.
   */
  fluid?: boolean;
}

function DatePickerCalendar({
  mode,
  selected,
  onSelect,
  numberOfMonths = 1,
  fromDate,
  toDate,
  locale,
  fluid = false,
}: DatePickerCalendarProps) {
  const today = new Date();

  const isMdUp = useMdUp() ?? true;
  const monthsToShow = isMdUp ? numberOfMonths : 1;

  const [draftRange, setDraftRange] = React.useState<DateRange | undefined>(
    mode === "range" ? (selected as DateRange | undefined) : undefined
  );
  const [hoveredDate, setHoveredDate] = React.useState<Date | undefined>(undefined);

  const rangeSelected = draftRange;
  const hasCompleteRange =
    mode === "range" &&
    !!rangeSelected?.from &&
    !!rangeSelected?.to &&
    rangeSelected.from.getTime() !== rangeSelected.to.getTime();

  const isPreviewDate = (date: Date): boolean => {
    if (!draftRange?.from || draftRange.to || !hoveredDate) return false;
    const start = Math.min(draftRange.from.getTime(), hoveredDate.getTime());
    const end = Math.max(draftRange.from.getTime(), hoveredDate.getTime());
    return date.getTime() >= start && date.getTime() <= end;
  };

  const handleRangeSelect = (triggerDate: Date | undefined): void => {
    if (!triggerDate) return;

    if (!draftRange?.from || draftRange.to) {
      setDraftRange({ from: triggerDate, to: undefined });
      return;
    }
    // Second click closes the range, ordering the two ends.
    const start = draftRange.from;
    const completed: DateRange =
      triggerDate.getTime() < start.getTime()
        ? { from: triggerDate, to: start }
        : { from: start, to: triggerDate };
    setDraftRange(completed);
    setHoveredDate(undefined);
    onSelect(completed);
  };

  // Fixed 40px cells by default; in fluid mode cells flex to fill the width.
  const cellOuter = fluid ? "flex-1 aspect-square min-w-0" : "size-10";
  const cellInner = fluid ? "size-full" : "size-10";

  const classNames: DayPickerProps["classNames"] = {
    root: cn("p-4 date-picker-calendar", fluid && "w-full"),
    months: "flex gap-8",
    month: cn("flex flex-col gap-2", fluid && "w-full"),
    month_caption: "hidden",
    nav: "hidden",
    month_grid: cn("border-collapse", fluid && "w-full"),
    weekdays: "flex",
    weekday: cn(
      cellOuter,
      "flex items-center justify-center",
      "text-[14px] font-medium leading-5 text-ods-text-secondary"
    ),
    week: "flex",
    day: cn(
      cellOuter,
      "flex items-center justify-center",
      "text-h4 text-ods-text-primary",
      "cursor-pointer",
      "transition-colors duration-150",
      "hover:bg-ods-bg-surface hover:rounded-[6px]"
    ),
    day_button: cn(
      cellInner,
      "flex items-center justify-center",
      "cursor-pointer bg-transparent border-none outline-none",
      "text-inherit font-inherit"
    ),
    today: "bg-ods-bg-surface rounded-[6px] hover:!bg-ods-bg-surface",
    selected: cn(
      "!bg-ods-accent !text-ods-card !font-bold !rounded-[6px] hover:!bg-ods-accent",
      // In range mode, selected class should not override range_start/range_end/range_middle
      mode === "range" && "range-selected"
    ),
    outside: "text-ods-border opacity-50 hover:!bg-transparent",
    disabled: "text-ods-border cursor-not-allowed hover:!bg-transparent",
    hidden: "invisible",
    // Range styles matching Figma design:
    // - range_start: bright yellow #ffc008, bold, left radius (full radius if single selection)
    // - range_end: bright yellow #ffc008, bold, right radius
    // - range_middle: dark yellow var(--ods-open-yellow-light), medium weight text
    // Border radius on row edges is handled via CSS in the style tag below
    range_start: cn(
      "range-start !bg-ods-accent !text-ods-card !font-bold hover:!bg-ods-accent",
      hasCompleteRange ? "!rounded-l-[6px] !rounded-r-none" : "!rounded-[6px]"
    ),
    range_end: cn(
      "range-end !bg-ods-accent !text-ods-card !font-bold hover:!bg-ods-accent",
      hasCompleteRange ? "!rounded-r-[6px] !rounded-l-none" : "!rounded-[6px]"
    ),
    range_middle: "range-middle !bg-[var(--ods-open-yellow-light)] !text-ods-card !font-medium !rounded-none hover:!bg-[var(--ods-open-yellow-light)]",
  };

  const [month, setMonth] = React.useState<Date>(
    mode === "single"
      ? (selected as Date) || today
      : (selected as DateRange)?.from || today
  );

  const handlePreviousMonth = () => {
    setMonth((prev) => {
      const newMonth = new Date(prev);
      newMonth.setMonth(newMonth.getMonth() - 1);
      return newMonth;
    });
  };

  const handleNextMonth = () => {
    setMonth((prev) => {
      const newMonth = new Date(prev);
      newMonth.setMonth(newMonth.getMonth() + 1);
      return newMonth;
    });
  };

  const formatMonthYear = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  const getSecondMonth = (date: Date): Date => {
    const next = new Date(date);
    next.setMonth(next.getMonth() + 1);
    return next;
  };

  // CSS for range styles:
  // - Ensure range_middle overrides selected styles (darker yellow for middle dates)
  // - Add row-edge border radius on range middle dates
  const rangeStyles = `
    .date-picker-calendar .range-middle {
      background-color: var(--ods-open-yellow-light) !important;
      font-weight: 500 !important;
    }
    .date-picker-calendar .range-middle:hover {
      background-color: var(--ods-open-yellow-light) !important;
    }
    .date-picker-calendar .range-start,
    .date-picker-calendar .range-end {
      background-color: var(--color-accent-primary) !important;
      font-weight: 700 !important;
    }
    .date-picker-calendar .range-start:hover,
    .date-picker-calendar .range-end:hover {
      background-color: var(--color-accent-primary) !important;
    }
    .date-picker-calendar .range-middle:first-child {
      border-top-left-radius: 6px !important;
      border-bottom-left-radius: 6px !important;
    }
    .date-picker-calendar .range-middle:last-child {
      border-top-right-radius: 6px !important;
      border-bottom-right-radius: 6px !important;
    }
  `;

  if (mode === "single") {
    return (
      <div className={cn("bg-ods-card border border-ods-border rounded-[6px] overflow-hidden", fluid && "w-full")}>
        <div className="flex items-center justify-between px-4 pt-4">
          <CalendarNavButton
            direction="left"
            onClick={handlePreviousMonth}
            aria-label="Previous month"
          />
          <span className="text-h4 text-ods-text-primary">
            {formatMonthYear(month)}
          </span>
          <CalendarNavButton
            direction="right"
            onClick={handleNextMonth}
            aria-label="Next month"
          />
        </div>
        <DayPicker
          mode="single"
          selected={selected as Date | undefined}
          onSelect={(date) => onSelect(date)}
          month={month}
          onMonthChange={setMonth}
          classNames={classNames}
          showOutsideDays
          fixedWeeks
          fromDate={fromDate}
          toDate={toDate}
          locale={locale}
          hideNavigation
        />
      </div>
    );
  }

  // Range mode
  return (
    <div
      className={cn("bg-ods-card border border-ods-border rounded-md overflow-hidden", fluid && "w-full")}
      onMouseLeave={() => setHoveredDate(undefined)}
    >
      <style>{rangeStyles}</style>
      <div className="flex">
        {/* First month */}
        <div className="flex-1">
          <div className="flex items-center justify-between px-4 pt-4">
            <CalendarNavButton
              direction="left"
              onClick={handlePreviousMonth}
              aria-label="Previous month"
            />
            <span className="text-h4 text-ods-text-primary">
              {formatMonthYear(month)}
            </span>
            {monthsToShow === 1 && (
              <CalendarNavButton
                direction="right"
                onClick={handleNextMonth}
                aria-label="Next month"
              />
            )}
            {monthsToShow === 2 && <div className="size-10 md:size-12" />}
          </div>
          <DayPicker
            mode="range"
            selected={draftRange}
            onSelect={(_range, triggerDate) => handleRangeSelect(triggerDate)}
            onDayMouseEnter={(day) => setHoveredDate(day)}
            modifiers={{ preview: isPreviewDate }}
            modifiersClassNames={{ preview: "bg-ods-bg-surface" }}
            month={month}
            onMonthChange={setMonth}
            classNames={classNames}
            showOutsideDays
            fixedWeeks
            fromDate={fromDate}
            toDate={toDate}
            locale={locale}
            hideNavigation
          />
        </div>

        {/* Second month (if monthsToShow === 2) */}
        {monthsToShow === 2 && (
          <div className="flex-1 border-l border-ods-border">
            <div className="flex items-center justify-between px-4 pt-4">
              <div className="size-10 md:size-12" />
              <span className="text-h4 text-ods-text-primary">
                {formatMonthYear(getSecondMonth(month))}
              </span>
              <CalendarNavButton
                direction="right"
                onClick={handleNextMonth}
                aria-label="Next month"
              />
            </div>
            <DayPicker
              mode="range"
              selected={draftRange}
              onSelect={(_range, triggerDate) => handleRangeSelect(triggerDate)}
              onDayMouseEnter={(day) => setHoveredDate(day)}
              modifiers={{ preview: isPreviewDate }}
              modifiersClassNames={{ preview: "bg-ods-bg-surface" }}
              month={getSecondMonth(month)}
              classNames={classNames}
              showOutsideDays
              fixedWeeks
              fromDate={fromDate}
              toDate={toDate}
              locale={locale}
              hideNavigation
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Trigger button styles (shared)
// ============================================================================

const triggerButtonStyles = cn(
  // Layout
  "flex items-center gap-2 w-full",
  "h-11 md:h-12 rounded-[6px] border px-3",
  // Colors
  "bg-ods-card border-ods-border",
  // Typography
  "text-h4",
  // Hover & active (not disabled)
  "enabled:hover:bg-ods-bg-hover enabled:hover:border-ods-border-hover enabled:active:bg-ods-bg-active enabled:active:border-ods-border-active",
  "focus:outline-none",
  // Disabled
  "disabled:!cursor-not-allowed disabled:bg-ods-bg",
  // Animation
  "transition-colors duration-200"
);

const timeSelectTriggerStyles = cn(
  "flex items-center justify-between gap-1",
  "h-11 md:h-12 min-h-0 px-3 rounded-[6px] border",
  "bg-ods-card border-ods-border",
  "text-h4",
  "enabled:hover:bg-ods-bg-hover enabled:hover:border-ods-border-hover enabled:active:bg-ods-bg-active enabled:active:border-ods-border-active",
  "focus:outline-none",
  "disabled:!cursor-not-allowed disabled:bg-ods-bg",
  "transition-colors duration-200 cursor-pointer",
  "text-ods-text-primary"
);

// ============================================================================
// DatePicker Component
// ============================================================================

export function DatePicker(props: DatePickerProps) {
  const {
    placeholder = "Select date",
    formatDate = defaultFormatDate,
    disabled = false,
    className,
    numberOfMonths = 1,
    fromDate,
    toDate,
    locale,
    label,
    error,
    invalid = false,
  } = props;

  const [open, setOpen] = React.useState(false);
  const isInvalid = invalid || !!error;

  const displayValue = React.useMemo(() => {
    if (props.mode === "single") {
      return props.value ? formatDate(props.value) : "";
    }
    return formatDateRange(props.value, formatDate);
  }, [props.mode, props.value, formatDate]);

  const handleSelect = (value: Date | DateRange | undefined) => {
    if (props.mode === "single") {
      props.onChange?.(value as Date | undefined);
      if (value) {
        setOpen(false);
      }
    } else {
      const range = value as DateRange | undefined;
      props.onChange?.(range);
      if (range?.from && range?.to) {
        setOpen(false);
      }
    }
  };

  const picker = (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(triggerButtonStyles, "group", open && !isInvalid && "border-ods-accent enabled:hover:border-ods-accent enabled:hover:bg-ods-card", isInvalid && "border-ods-error enabled:hover:border-ods-error enabled:hover:bg-ods-card", className)}
        >
          <Calendar className="size-6 text-ods-text-secondary shrink-0" />
          <span
            className={cn(
              "flex-1 text-left truncate",
              displayValue ? "text-ods-text-primary" : "text-ods-text-secondary"
            )}
          >
            {displayValue || placeholder}
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className={cn(
            "z-[9999]",
            "animate-in fade-in-0 zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "data-[side=bottom]:slide-in-from-top-2",
            "data-[side=top]:slide-in-from-bottom-2"
          )}
          sideOffset={8}
          align="start"
        >
          <DatePickerCalendar
            mode={props.mode}
            selected={props.value}
            onSelect={handleSelect}
            numberOfMonths={numberOfMonths}
            fromDate={fromDate}
            toDate={toDate}
            locale={locale}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );

  return (
    <FieldWrapper label={label} error={error}>
      {picker}
    </FieldWrapper>
  );
}

// ============================================================================
// DatePickerInput Component (with time selector styling from Figma)
// ============================================================================

export interface DatePickerInputProps extends DatePickerBaseProps {
  mode?: "single";
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  /** Show time selector next to date */
  showTime?: boolean;
  /** Use 24-hour format instead of 12-hour */
  use24HourFormat?: boolean;
}

// Generate hour options
const generateHourOptions = (use24Hour: boolean): string[] => {
  if (use24Hour) {
    return Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
  }
  return Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, "0"));
};

// Generate minute options (00, 01, 02, ... 59)
const generateMinuteOptions = (): string[] => {
  return Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));
};

export function DatePickerInput({
  placeholder = "Select date",
  formatDate = defaultFormatDate,
  disabled = false,
  className,
  numberOfMonths = 1,
  fromDate,
  toDate,
  locale,
  value,
  onChange,
  showTime = false,
  use24HourFormat = false,
  label,
  error,
  invalid = false,
}: DatePickerInputProps) {
  const [open, setOpen] = React.useState(false);
  const isInvalid = invalid || !!error;

  const displayValue = value ? formatDate(value) : "";

  // Extract time from value
  const hour = React.useMemo(() => {
    if (!value) return "";
    const hours = value.getHours();
    if (use24HourFormat) {
      return hours.toString().padStart(2, "0");
    }
    const hour12 = hours % 12 || 12;
    return hour12.toString().padStart(2, "0");
  }, [value, use24HourFormat]);

  const minute = React.useMemo(() => {
    if (!value) return "";
    return value.getMinutes().toString().padStart(2, "0");
  }, [value]);

  const period = React.useMemo((): "AM" | "PM" => {
    if (!value) return "AM";
    return value.getHours() >= 12 ? "PM" : "AM";
  }, [value]);

  const handleSelect = (date: Date | DateRange | undefined) => {
    const newDate = date as Date | undefined;
    if (newDate && value) {
      // Preserve time when selecting a new date
      newDate.setHours(value.getHours(), value.getMinutes(), 0, 0);
    }
    onChange?.(newDate);
    if (newDate) {
      setOpen(false);
    }
  };

  const handleHourChange = (newHour: string) => {
    const date = value ? new Date(value) : new Date();
    let hours = parseInt(newHour, 10);
    if (!use24HourFormat) {
      const isPM = period === "PM";
      if (hours === 12) {
        hours = isPM ? 12 : 0;
      } else {
        hours = isPM ? hours + 12 : hours;
      }
    }
    date.setHours(hours);
    onChange?.(date);
  };

  const handleMinuteChange = (newMinute: string) => {
    const date = value ? new Date(value) : new Date();
    date.setMinutes(parseInt(newMinute, 10));
    onChange?.(date);
  };

  const handlePeriodChange = (newPeriod: "AM" | "PM") => {
    const date = value ? new Date(value) : new Date();
    let hours = date.getHours();
    if (newPeriod === "AM" && hours >= 12) {
      hours -= 12;
    } else if (newPeriod === "PM" && hours < 12) {
      hours += 12;
    }
    date.setHours(hours);
    onChange?.(date);
  };

  const hourOptions = React.useMemo(() => generateHourOptions(use24HourFormat), [use24HourFormat]);
  const minuteOptions = React.useMemo(() => generateMinuteOptions(), []);

  const content = (
    <div className={cn("flex items-center gap-2", !label && !error && className)}>
      {/* Date Picker */}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(triggerButtonStyles, "group", open && !isInvalid && "border-ods-accent enabled:hover:border-ods-accent enabled:hover:bg-ods-card", isInvalid && "border-ods-error enabled:hover:border-ods-error enabled:hover:bg-ods-card", "flex-1")}
          >
            <Calendar className="size-6 text-ods-text-secondary shrink-0" />
            <span
              className={cn(
                "flex-1 text-left truncate",
                displayValue ? "text-ods-text-primary" : "text-ods-text-secondary"
              )}
            >
              {displayValue || placeholder}
            </span>
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            className={cn(
              "z-[9999]",
              "animate-in fade-in-0 zoom-in-95",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
              "data-[side=bottom]:slide-in-from-top-2",
              "data-[side=top]:slide-in-from-bottom-2"
            )}
            sideOffset={8}
            align="start"
          >
            <DatePickerCalendar
              mode="single"
              selected={value}
              onSelect={handleSelect}
              numberOfMonths={numberOfMonths}
              fromDate={fromDate}
              toDate={toDate}
              locale={locale}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* Time Selects (optional) */}
      {showTime && (
        <div className="flex items-center gap-1">
          {/* Hour Select */}
          <Select
            value={hour}
            onValueChange={handleHourChange}
            disabled={disabled}
          >
            <SelectTrigger className={cn(timeSelectTriggerStyles, "w-[80px]")}>
              <SelectValue placeholder="HH" />
            </SelectTrigger>
            <SelectContent>
              {hourOptions.map((h) => (
                <SelectItem key={h} value={h}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-ods-text-secondary text-h4">:</span>

          {/* Minute Select */}
          <Select
            value={minute}
            onValueChange={handleMinuteChange}
            disabled={disabled}
          >
            <SelectTrigger className={cn(timeSelectTriggerStyles, "w-[80px]")}>
              <SelectValue placeholder="MM" />
            </SelectTrigger>
            <SelectContent>
              {minuteOptions.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* AM/PM Select (only for 12-hour format) */}
          {!use24HourFormat && (
            <Select
              value={period}
              onValueChange={(val) => handlePeriodChange(val as "AM" | "PM")}
              disabled={disabled}
            >
              <SelectTrigger className={cn(timeSelectTriggerStyles, "w-[80px]")}>
                <SelectValue placeholder="AM" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AM">AM</SelectItem>
                <SelectItem value="PM">PM</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  );

  return (
    <FieldWrapper label={label} error={error} className={className}>
      {content}
    </FieldWrapper>
  );
}

// ============================================================================
// DatePickerInputSimple Component (with single time selector)
// ============================================================================

export interface DatePickerInputSimpleProps extends DatePickerBaseProps {
  mode?: "single";
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  /** Show time selector next to date */
  showTime?: boolean;
  /** Time interval in minutes (default: 30) */
  timeInterval?: number;
  /** Use 24-hour format instead of 12-hour */
  use24HourFormat?: boolean;
}

// Generate time options with specified interval
const generateTimeOptions = (
  intervalMinutes: number,
  use24Hour: boolean
): { value: string; label: string }[] => {
  const options: { value: string; label: string }[] = [];
  const totalMinutesInDay = 24 * 60;

  for (let minutes = 0; minutes < totalMinutesInDay; minutes += intervalMinutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    const value = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;

    let label: string;
    if (use24Hour) {
      label = value;
    } else {
      const hour12 = hours % 12 || 12;
      const period = hours >= 12 ? "PM" : "AM";
      label = `${hour12.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")} ${period}`;
    }

    options.push({ value, label });
  }

  return options;
};

export function DatePickerInputSimple({
  placeholder = "Select date",
  formatDate = defaultFormatDate,
  disabled = false,
  className,
  numberOfMonths = 1,
  fromDate,
  toDate,
  locale,
  value,
  onChange,
  showTime = false,
  timeInterval = 30,
  use24HourFormat = false,
  label,
  error,
  invalid = false,
}: DatePickerInputSimpleProps) {
  const [open, setOpen] = React.useState(false);
  const isInvalid = invalid || !!error;

  const displayValue = value ? formatDate(value) : "";

  // Get current time value as HH:MM string
  const timeValue = React.useMemo(() => {
    if (!value) return "";
    const hours = value.getHours();
    const minutes = value.getMinutes();
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }, [value]);

  // Get display label for current time
  const timeDisplayLabel = React.useMemo(() => {
    if (!value) return "";
    const hours = value.getHours();
    const minutes = value.getMinutes();

    if (use24HourFormat) {
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    }

    const hour12 = hours % 12 || 12;
    const period = hours >= 12 ? "PM" : "AM";
    return `${hour12.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")} ${period}`;
  }, [value, use24HourFormat]);

  const handleSelect = (date: Date | DateRange | undefined) => {
    const newDate = date as Date | undefined;
    if (newDate && value) {
      // Preserve time when selecting a new date
      newDate.setHours(value.getHours(), value.getMinutes(), 0, 0);
    }
    onChange?.(newDate);
    if (newDate) {
      setOpen(false);
    }
  };

  const handleTimeChange = (newTime: string) => {
    const [hours, minutes] = newTime.split(":").map(Number);
    const date = value ? new Date(value) : new Date();
    date.setHours(hours, minutes, 0, 0);
    onChange?.(date);
  };

  const timeOptions = React.useMemo(
    () => generateTimeOptions(timeInterval, use24HourFormat),
    [timeInterval, use24HourFormat]
  );

  const content = (
    <div className={cn("flex items-center gap-2", !label && !error && className)}>
      {/* Date Picker */}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(triggerButtonStyles, "group", open && !isInvalid && "border-ods-accent enabled:hover:border-ods-accent enabled:hover:bg-ods-card", isInvalid && "border-ods-error enabled:hover:border-ods-error enabled:hover:bg-ods-card", "flex-1")}
          >
            <Calendar className="size-6 text-ods-text-secondary shrink-0" />
            <span
              className={cn(
                "flex-1 text-left truncate",
                displayValue ? "text-ods-text-primary" : "text-ods-text-secondary"
              )}
            >
              {displayValue || placeholder}
            </span>
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            className={cn(
              "z-[9999]",
              "animate-in fade-in-0 zoom-in-95",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
              "data-[side=bottom]:slide-in-from-top-2",
              "data-[side=top]:slide-in-from-bottom-2"
            )}
            sideOffset={8}
            align="start"
          >
            <DatePickerCalendar
              mode="single"
              selected={value}
              onSelect={handleSelect}
              numberOfMonths={numberOfMonths}
              fromDate={fromDate}
              toDate={toDate}
              locale={locale}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* Single Time Select (optional) */}
      {showTime && (
        <Select
          value={timeValue}
          onValueChange={handleTimeChange}
          disabled={disabled}
        >
          <SelectTrigger className={cn(timeSelectTriggerStyles, "flex-1")}>
            <SelectValue placeholder="Select time">
              {timeDisplayLabel || "Select time"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {timeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );

  return (
    <FieldWrapper label={label} error={error} className={className}>
      {content}
    </FieldWrapper>
  );
}

// ============================================================================
// DateFilterMenu Component (sort + calendar filter popover from Figma)
// ============================================================================

export interface DateFilterResult {
  /** Selected sort direction */
  sort: SortDirection;
  /** Selected single date (mode === "single") */
  date?: Date;
  /** Selected date range (mode === "range") */
  range?: DateRange;
}

export interface DateFilterMenuProps {
  /** Selection mode for the calendar. Defaults to "range". */
  mode?: DatePickerMode;
  /** Current (applied) sort direction. Defaults to "desc". */
  sort?: SortDirection;
  /** Current (applied) single date — used when mode === "single". */
  date?: Date;
  /** Current (applied) range — used when mode === "range". */
  range?: DateRange;
  /** Fired when the user presses Apply with the drafted selection. Also fired
   *  by Reset with a cleared selection so the consumer refetches unfiltered data. */
  onApply?: (result: DateFilterResult) => void;
  /** Fired immediately when the sort direction changes — sort is committed
   *  right away, without waiting for Apply. */
  onSortChange?: (sort: SortDirection) => void;
  /** Fired when the menu closes (Close button, outside click, Esc). */
  onClose?: () => void;
  /** Disable the trigger. */
  disabled?: boolean;
  /** Minimum selectable date. */
  fromDate?: Date;
  /** Maximum selectable date. */
  toDate?: Date;
  /** Locale for the calendar. */
  locale?: DayPickerProps["locale"];
  /** Popover alignment relative to the trigger. */
  align?: "start" | "center" | "end";
  /** Label for the ascending sort option. */
  ascLabel?: string;
  /** Label for the descending sort option. */
  descLabel?: string;
  /** Additional class name for the trigger button. */
  className?: string;
  /** Accessible label for the trigger. */
  "aria-label"?: string;
}

/**
 * DateFilterMenu — a calendar-icon-triggered popover combining a sort-direction
 * selector and a date / date-range calendar, with Close/Reset and Apply actions.
 * The date selection is drafted internally and committed via `onApply`; the
 * sort direction commits immediately on change (`onSortChange`). While a date
 * is selected, Close is replaced by Reset, which clears and commits the empty
 * selection (fires `onApply`) so the consumer drops the filter.
 */
export function DateFilterMenu({
  mode = "range",
  sort = "desc",
  date,
  range,
  onApply,
  onSortChange,
  onClose,
  disabled = false,
  fromDate,
  toDate,
  locale,
  align = "start",
  ascLabel = "Sort by Ascending",
  descLabel = "Sort by Descending",
  className,
  "aria-label": ariaLabel = "Open date filter",
}: DateFilterMenuProps) {
  const [open, setOpen] = React.useState(false);

  // Drafted selection — initialized from props each time the menu opens.
  const [draftSort, setDraftSort] = React.useState<SortDirection>(sort);
  const [draftSelected, setDraftSelected] = React.useState<
    Date | DateRange | undefined
  >(mode === "single" ? date : range);

  const resetDraft = React.useCallback(() => {
    setDraftSort(sort);
    setDraftSelected(mode === "single" ? date : range);
  }, [sort, date, range, mode]);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      resetDraft();
    } else {
      onClose?.();
    }
    setOpen(next);
  };

  const handleApply = () => {
    const result: DateFilterResult =
      mode === "single"
        ? { sort: draftSort, date: draftSelected as Date | undefined }
        : { sort: draftSort, range: draftSelected as DateRange | undefined };
    onApply?.(result);
    setOpen(false);
  };

  const handleSortChange = (value: string) => {
    const next = value as SortDirection;
    setDraftSort(next);
    // Sort commits immediately — no Apply needed.
    onSortChange?.(next);
  };

  const handleClose = () => {
    onClose?.();
    setOpen(false);
  };

  // Whether the calendar has any (drafted or applied) selection — drives Close vs Reset.
  const hasSelection =
    mode === "single"
      ? Boolean(draftSelected)
      : Boolean((draftSelected as DateRange | undefined)?.from);

  // Reset clears the selection and commits it so the consumer drops the date
  // filter and refetches; the menu stays open with the button back to Close.
  const handleReset = () => {
    setDraftSelected(undefined);
    onApply?.(
      mode === "single"
        ? { sort: draftSort, date: undefined }
        : { sort: draftSort, range: undefined }
    );
  };

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          aria-label={ariaLabel}
          className={className}
          leftIcon={<Calendar className="size-6" />}
        />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className={cn(
            "z-[9999] w-80 max-w-[calc(100vw-2rem)]",
            "flex flex-col gap-4 rounded-[6px] border border-ods-border bg-ods-bg p-4",
            "animate-in fade-in-0 zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "data-[side=bottom]:slide-in-from-top-2",
            "data-[side=top]:slide-in-from-bottom-2"
          )}
          sideOffset={8}
          align={align}
        >
          {/* Sort direction selector */}
          <Select value={draftSort} onValueChange={handleSortChange}>
            <SelectTrigger className="gap-2" aria-label="Sort direction">
              {/* Wrapper is a <div> (not <span>) so SelectTrigger's
                  `[&>span]:line-clamp-1` rule doesn't force it to a vertical
                  -webkit-box and stack the icon/label into a column. */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <ArrowUpDown className="size-6 shrink-0 text-ods-text-secondary" />
                <span className="truncate">
                  <SelectValue />
                </span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">{ascLabel}</SelectItem>
              <SelectItem value="desc">{descLabel}</SelectItem>
            </SelectContent>
          </Select>

          {/* Calendar */}
          <DatePickerCalendar
            mode={mode}
            selected={draftSelected}
            onSelect={setDraftSelected}
            numberOfMonths={1}
            fromDate={fromDate}
            toDate={toDate}
            locale={locale}
            fluid
          />

          {/* Actions */}
          <div className="flex w-full items-stretch gap-4">
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={hasSelection ? handleReset : handleClose}
            >
              {hasSelection ? "Reset" : "Close"}
            </Button>
            <Button
              type="button"
              variant="accent"
              fullWidth
              onClick={handleApply}
            >
              Apply
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ============================================================================
// Exports
// ============================================================================

export { type DateRange };

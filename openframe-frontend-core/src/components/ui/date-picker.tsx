"use client";

import * as Popover from "@radix-ui/react-popover";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import {
  DayPicker,
  type DateRange,
  type DayPickerProps,
} from "react-day-picker";
import { cn } from "../../utils/cn";
import { Button } from "./button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

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
      variant="card"
      size="icon"
      onClick={onClick}
      aria-label={ariaLabel}
      centerIcon={direction === "left" ? <ChevronLeft className="size-6" /> : <ChevronRight className="size-6" />}
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
}

function DatePickerCalendar({
  mode,
  selected,
  onSelect,
  numberOfMonths = 1,
  fromDate,
  toDate,
  locale,
}: DatePickerCalendarProps) {
  const today = new Date();

  // Check if we have a complete range (both from and to, and they're different)
  const rangeSelected = selected as DateRange | undefined;
  const hasCompleteRange =
    mode === "range" &&
    rangeSelected?.from &&
    rangeSelected?.to &&
    rangeSelected.from.getTime() !== rangeSelected.to.getTime();

  const classNames: DayPickerProps["classNames"] = {
    root: "p-4 date-picker-calendar",
    months: "flex gap-8",
    month: "flex flex-col gap-2",
    month_caption: "hidden",
    nav: "hidden",
    month_grid: "border-collapse",
    weekdays: "flex",
    weekday: cn(
      "size-10 flex items-center justify-center",
      "text-[14px] font-medium leading-5 text-[#888]"
    ),
    week: "flex",
    day: cn(
      "size-10 flex items-center justify-center",
      "text-[18px] font-medium leading-6 text-[#fafafa]",
      "cursor-pointer",
      "transition-colors duration-150",
      "hover:bg-[#3a3a3a] hover:rounded-[6px]"
    ),
    day_button: cn(
      "size-10 flex items-center justify-center",
      "cursor-pointer bg-transparent border-none outline-none",
      "text-inherit font-inherit"
    ),
    today: "bg-[#3a3a3a] rounded-[6px] hover:!bg-[#3a3a3a]",
    selected: cn(
      "!bg-[#ffc008] !text-[#212121] !font-bold !rounded-[6px] hover:!bg-[#ffc008]",
      // In range mode, selected class should not override range_start/range_end/range_middle
      mode === "range" && "range-selected"
    ),
    outside: "text-[#3a3a3a] opacity-50 hover:!bg-transparent",
    disabled: "text-[#3a3a3a] cursor-not-allowed hover:!bg-transparent",
    hidden: "invisible",
    // Range styles matching Figma design:
    // - range_start: bright yellow #ffc008, bold, left radius (full radius if single selection)
    // - range_end: bright yellow #ffc008, bold, right radius
    // - range_middle: dark yellow #7f6004, medium weight text
    // Border radius on row edges is handled via CSS in the style tag below
    range_start: cn(
      "range-start !bg-[#ffc008] !text-[#212121] !font-bold hover:!bg-[#ffc008]",
      hasCompleteRange ? "!rounded-l-[6px] !rounded-r-none" : "!rounded-[6px]"
    ),
    range_end: cn(
      "range-end !bg-[#ffc008] !text-[#212121] !font-bold hover:!bg-[#ffc008]",
      hasCompleteRange ? "!rounded-r-[6px] !rounded-l-none" : "!rounded-[6px]"
    ),
    range_middle: "range-middle !bg-[#7f6004] !text-[#212121] !font-medium !rounded-none hover:!bg-[#7f6004]",
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
      background-color: #7f6004 !important;
      font-weight: 500 !important;
    }
    .date-picker-calendar .range-middle:hover {
      background-color: #7f6004 !important;
    }
    .date-picker-calendar .range-start,
    .date-picker-calendar .range-end {
      background-color: #ffc008 !important;
      font-weight: 700 !important;
    }
    .date-picker-calendar .range-start:hover,
    .date-picker-calendar .range-end:hover {
      background-color: #ffc008 !important;
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
      <div className="bg-[#212121] border border-[#3a3a3a] rounded-[6px] overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4">
          <CalendarNavButton
            direction="left"
            onClick={handlePreviousMonth}
            aria-label="Previous month"
          />
          <span className="text-[18px] font-medium leading-6 text-[#fafafa]">
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
    <div className="bg-[#212121] border border-[#3a3a3a] rounded-[6px] overflow-hidden">
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
            <span className="text-[18px] font-medium leading-6 text-[#fafafa]">
              {formatMonthYear(month)}
            </span>
            {numberOfMonths === 1 && (
              <CalendarNavButton
                direction="right"
                onClick={handleNextMonth}
                aria-label="Next month"
              />
            )}
            {numberOfMonths === 2 && <div className="size-10 sm:size-12" />}
          </div>
          <DayPicker
            mode="range"
            selected={selected as DateRange | undefined}
            onSelect={(range) => onSelect(range)}
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

        {/* Second month (if numberOfMonths === 2) */}
        {numberOfMonths === 2 && (
          <div className="flex-1 border-l border-[#3a3a3a]">
            <div className="flex items-center justify-between px-4 pt-4">
              <div className="size-10 sm:size-12" />
              <span className="text-[18px] font-medium leading-6 text-[#fafafa]">
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
              selected={selected as DateRange | undefined}
              onSelect={(range) => onSelect(range)}
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
  "h-11 sm:h-12 rounded-[6px] border px-3",
  // Colors
  "bg-[#212121] border-[#3a3a3a]",
  // Typography
  "text-[18px] font-medium leading-6",
  // States
  "hover:border-ods-accent/30",
  "focus:outline-none focus:ring-1 focus:ring-ods-accent/20 focus:border-ods-accent",
  "disabled:cursor-not-allowed disabled:opacity-50",
  // Animation
  "transition-colors duration-200"
);

const timeSelectTriggerStyles = cn(
  "flex items-center justify-between gap-1",
  "h-11 sm:h-12 min-h-0 px-3 rounded-[6px] border",
  "bg-[#212121] border-[#3a3a3a]",
  "text-[18px] font-medium leading-6",
  "hover:border-ods-accent/30",
  "focus:outline-none focus:ring-1 focus:ring-ods-accent/20 focus:border-ods-accent",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "transition-colors duration-200 cursor-pointer",
  "text-[#fafafa]"
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
  } = props;

  const [open, setOpen] = React.useState(false);

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
      // Only close popover when BOTH from and to dates are selected
      // Don't close when user just selected the start date
      if (range?.from && range?.to && range.from.getTime() !== range.to.getTime()) {
        setOpen(false);
      }
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(triggerButtonStyles, className)}
        >
          <Calendar className="size-6 text-[#888] shrink-0" />
          <span
            className={cn(
              "flex-1 text-left truncate",
              displayValue ? "text-[#fafafa]" : "text-[#888]"
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
}: DatePickerInputProps) {
  const [open, setOpen] = React.useState(false);

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

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Date Picker */}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(triggerButtonStyles, "flex-1")}
          >
            <Calendar className="size-6 text-[#888] shrink-0" />
            <span
              className={cn(
                "flex-1 text-left truncate",
                displayValue ? "text-[#fafafa]" : "text-[#888]"
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

          <span className="text-[#888] text-[18px] font-medium">:</span>

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
}: DatePickerInputSimpleProps) {
  const [open, setOpen] = React.useState(false);

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

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Date Picker */}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(triggerButtonStyles, "flex-1")}
          >
            <Calendar className="size-6 text-[#888] shrink-0" />
            <span
              className={cn(
                "flex-1 text-left truncate",
                displayValue ? "text-[#fafafa]" : "text-[#888]"
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
}

// ============================================================================
// Exports
// ============================================================================

export { type DateRange };

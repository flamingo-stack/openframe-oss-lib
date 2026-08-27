"use client";

import { Label } from "./ui/label";
import DatePicker from 'react-datepicker';
import { cn } from '../utils/cn';

interface DateTimePickerProps {
  value?: Date;
  onChange: (date: Date | null) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  className?: string;
  showTimeSelect?: boolean;
  timeFormat?: string;
  timeIntervals?: number;
  dateFormat?: string;
}

// Shared input styling that matches Input component pattern
const inputClassName = cn(
  "flex h-10 w-full rounded-md border px-3 py-2 text-sm ring-offset-background",
  "file:border-0 file:bg-transparent file:text-sm file:font-medium",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
  "disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation",
  // Admin theme colors
  "bg-ods-card border-ods-border text-ods-text-primary",
  "placeholder:text-ods-text-muted focus-visible:ring-ods-accent",
  "md:text-sm text-base" // Mobile zoom prevention
);

export function DateTimePicker({
  value,
  onChange,
  disabled = false,
  label,
  placeholder = "Select date and time",
  className,
  showTimeSelect = true,
  timeFormat = "HH:mm",
  timeIntervals = 15,
  dateFormat = "MMMM d, yyyy h:mm aa"
}: DateTimePickerProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label className="text-h5 font-semibold text-ods-text-secondary">
          {label}
        </Label>
      )}

      <div className="w-full">
        <DatePicker
          selected={value}
          onChange={onChange}
          showTimeSelect={showTimeSelect}
          timeFormat={timeFormat}
          timeIntervals={timeIntervals}
          dateFormat={dateFormat}
          placeholderText={placeholder}
          disabled={disabled}
          wrapperClassName="w-full"
          className={inputClassName}
        />
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .react-datepicker-wrapper {
          width: 100% !important;
          display: block !important;
        }

        .react-datepicker__input-container {
          width: 100% !important;
        }

        .react-datepicker__input-container input {
          width: 100% !important;
        }

        /* Dark theme for calendar popup */
        .react-datepicker-popper {
          z-index: 9999 !important;
        }

        .react-datepicker {
          background-color: var(--ods-card) !important;
          border: 1px solid var(--ods-border) !important;
          color: var(--ods-text-primary) !important;
          z-index: 9999 !important;
        }

        .react-datepicker__header {
          background-color: var(--ods-card) !important;
          border-bottom: 1px solid var(--ods-border) !important;
          color: var(--ods-text-primary) !important;
        }

        .react-datepicker__current-month {
          color: var(--ods-text-primary) !important;
        }

        .react-datepicker__day-name {
          color: var(--ods-text-muted) !important;
        }

        .react-datepicker__day {
          color: var(--ods-text-primary) !important;
        }

        .react-datepicker__day:hover {
          background-color: var(--ods-border) !important;
        }

        .react-datepicker__day--selected {
          background-color: var(--ods-accent) !important;
          color: var(--ods-text-inverse, #000000) !important;
        }

        .react-datepicker__day--keyboard-selected {
          background-color: var(--ods-accent) !important;
          color: var(--ods-text-inverse, #000000) !important;
        }

        .react-datepicker__time-container {
          border-left: 1px solid var(--ods-border) !important;
        }

        .react-datepicker__time {
          background: var(--ods-card) !important;
        }

        .react-datepicker__time-box {
          width: 85px !important;
        }

        .react-datepicker-time__header {
          background-color: var(--ods-card) !important;
          color: var(--ods-text-primary) !important;
        }

        .react-datepicker__time-list-item {
          color: var(--ods-text-primary) !important;
        }

        .react-datepicker__time-list-item:hover {
          background-color: var(--ods-border) !important;
        }

        .react-datepicker__time-list-item--selected {
          background-color: var(--ods-accent) !important;
          color: var(--ods-text-inverse, #000000) !important;
        }

        .react-datepicker__navigation {
          top: 1rem !important;
        }

        .react-datepicker__navigation--previous {
          border-right-color: var(--ods-text-muted) !important;
        }

        .react-datepicker__navigation--next {
          border-left-color: var(--ods-text-muted) !important;
        }
      ` }} />
    </div>
  );
} 

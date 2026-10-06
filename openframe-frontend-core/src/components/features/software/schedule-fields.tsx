'use client';

import { DatePickerInputSimple, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui';

export interface SoftwareScheduleOption<V extends string = string> {
  value: V;
  label: string;
}

/**
 * How a schedule's start is read: the timezone choices, the time slots a day
 * offers, the first day that can be picked and whether a start has gone by.
 * The host owns these rules (the product shares them with script schedules).
 */
export interface SoftwareScheduleTiming<TRef extends string = string> {
  timeReferenceOptions: ReadonlyArray<SoftwareScheduleOption<TRef>>;
  getTimeOptions: (date: Date | null, timeReference: TRef) => SoftwareScheduleOption[];
  getEarliestDay: (timeReference: TRef) => Date | undefined;
  /** The message for a start that cannot be scheduled; undefined when it can. */
  getStartError: (date: Date | null, time: string, timeReference: TRef) => string | undefined;
}

export interface SoftwareScheduleFieldsProps<TRef extends string = string> {
  date: Date | null;
  time: string;
  timeReference: TRef;
  timing: SoftwareScheduleTiming<TRef>;
  onDateChange: (date: Date | null) => void;
  onTimeChange: (time: string) => void;
  onTimeReferenceChange: (reference: TRef) => void;
}

/** Date / Time / Timezone: the same grid and readings as a script schedule's start. */
export function SoftwareScheduleFields<TRef extends string = string>({
  date,
  time,
  timeReference,
  timing,
  onDateChange,
  onTimeChange,
  onTimeReferenceChange,
}: SoftwareScheduleFieldsProps<TRef>) {
  const timeOptions = timing.getTimeOptions(date, timeReference);
  const startError = timing.getStartError(date, time, timeReference);

  return (
    <div className="grid grid-cols-1 gap-[var(--spacing-system-lf)] content-md:grid-cols-4 content-md:items-start">
      <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
        <Label className="text-h4">Date</Label>
        <DatePickerInputSimple
          placeholder="Select date"
          value={date ?? undefined}
          onChange={next => onDateChange(next ?? null)}
          fromDate={timing.getEarliestDay(timeReference)}
          className="w-full"
          error={startError}
          invalid={!!startError}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
        <Label className="text-h4">Time</Label>
        <Select value={time} onValueChange={onTimeChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select time" />
          </SelectTrigger>
          <SelectContent>
            {timeOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
        <Label className="text-h4">Timezone</Label>
        <Select value={timeReference} onValueChange={value => onTimeReferenceChange(value as TRef)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {timing.timeReferenceOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

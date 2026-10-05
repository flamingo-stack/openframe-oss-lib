'use client';

import { useMemo } from 'react';
import { Autocomplete } from './autocomplete';

/** An IANA zone as people read it: "Europe/Rome (GMT+2)". */
export function timezoneLabel(tz: string): string {
  const name = tz.replace(/_/g, ' ');
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());
    const offset = parts.find(p => p.type === 'timeZoneName')?.value ?? '';
    return offset ? `${name} (${offset})` : name;
  } catch {
    return name;
  }
}

/** Every IANA zone the runtime knows, with `current` kept in the list when it is not one of them. */
export function timezoneOptions(current?: string | null): { value: string; label: string }[] {
  let zones: string[] = [];
  try {
    // Older lib targets don't type supportedValuesOf (ES2022) — runtime-guarded.
    const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
    zones = intl.supportedValuesOf ? intl.supportedValuesOf('timeZone') : [];
  } catch {
    zones = [];
  }
  if (current && !zones.includes(current)) zones = [current, ...zones];
  return zones.map(tz => ({ value: tz, label: timezoneLabel(tz) }));
}

export interface TimezoneSelectProps {
  /** The chosen IANA zone; empty or null for none. */
  value: string | null;
  /** The zone picked, or null when the field was cleared (only with `clearable`). */
  onChange: (timezone: string | null) => void;
  disabled?: boolean;
  /** Whether the field may be emptied. Default false: a zone, once set, is only replaced. */
  clearable?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * THE timezone picker: a searchable list of every IANA zone with its live GMT
 * offset. The meeting scheduler and every form that stores a zone use it, so a
 * zone is always chosen from the list and never typed.
 */
export function TimezoneSelect({
  value,
  onChange,
  disabled,
  clearable = false,
  placeholder = 'Search timezone…',
  className,
}: TimezoneSelectProps) {
  const options = useMemo(() => timezoneOptions(value), [value]);
  return (
    <Autocomplete
      className={className}
      value={value || null}
      disabled={disabled}
      onChange={tz => {
        if (tz || clearable) onChange(tz ?? null);
      }}
      options={options}
      placeholder={placeholder}
      noOptionsText="No matching timezone"
      showClearAll={clearable}
    />
  );
}

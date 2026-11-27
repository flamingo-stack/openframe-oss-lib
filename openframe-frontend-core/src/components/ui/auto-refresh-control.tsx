'use client';

import { useMemo } from 'react';
import { cn } from '../../utils/cn';
import { Refresh02VrIcon } from '../icons-v2-generated/media-playback/refresh-02-vr-icon';
import { DropdownButton } from './dropdown-button';

/** One choice of the auto-refresh control: its URL value (`30s`) and what the menu says. */
export interface AutoRefreshOption {
  value: string;
  label: string;
}

/** The value meaning "no auto-refresh". */
export const AUTO_REFRESH_OFF = 'off';

/** The table default: off, 10 s, 30 s, 1 min. */
export const DEFAULT_AUTO_REFRESH_OPTIONS: readonly AutoRefreshOption[] = [
  { value: AUTO_REFRESH_OFF, label: 'Off' },
  { value: '10s', label: '10s' },
  { value: '30s', label: '30s' },
  { value: '1m', label: '1m' },
];

/**
 * The interval a refresh value names, in ms: `10s` → 10000, `1m` → 60000. `null` for off, an empty value, or anything
 * it cannot read (a hand-edited URL), so a bad value never starts a timer.
 */
export function autoRefreshIntervalMs(value: string | null | undefined): number | null {
  const match = /^(\d+)(s|m)$/.exec(value ?? '');
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount * (match[2] === 'm' ? 60_000 : 1_000);
}

export interface AutoRefreshControlProps {
  /** The current value (`off`, `30s`, …). A value not in `options` reads as off. */
  value: string;
  onChange: (value: string) => void;
  options?: readonly AutoRefreshOption[];
  disabled?: boolean;
  /** The control's name, read before its value ("Auto-refresh: 30s"). */
  label?: string;
  className?: string;
}

/**
 * The auto-refresh picker of a table (the design's `auto-refresh`): a 32px outline button with the refresh glyph, the
 * current interval in the mono caption ("OFF", "30S") and a chevron, opening the choices. The glyph takes the accent
 * while a refresh runs. It sits at the right end of the row above the table (`DataTable.Meta`'s `actions`).
 * Presentational: the timer, its gates and the URL key belong to the caller.
 */
export function AutoRefreshControl({
  value,
  onChange,
  options = DEFAULT_AUTO_REFRESH_OPTIONS,
  disabled,
  label = 'Auto-refresh',
  className,
}: AutoRefreshControlProps) {
  const current = options.find(option => option.value === value) ?? options[0];
  const on = !!current && current.value !== AUTO_REFRESH_OFF;

  const items = useMemo(
    () =>
      options.map(option => ({
        id: option.value,
        label: option.label,
        type: 'radio' as const,
        checked: option.value === current?.value,
        onClick: () => onChange(option.value),
      })),
    [options, current?.value, onChange],
  );

  return (
    <DropdownButton
      variant="outline"
      size="small"
      align="end"
      disabled={disabled}
      // The small button's mono caption, 32px at every width (the design's control height beside the pager's arrows).
      className={cn('h-8', className)}
      ariaLabel={`${label}: ${current?.label ?? ''}`}
      icon={<Refresh02VrIcon size={16} className={cn(on ? 'text-ods-accent' : 'text-ods-text-secondary')} />}
      label={current?.label}
      items={items}
    />
  );
}

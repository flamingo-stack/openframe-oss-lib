'use client';

import { cn } from '../../../utils/cn';
import { CalendarIcon } from '../../icons-v2-generated';
import { DateFilterMenu } from '../date-picker';
import type { DataTableDateFilter } from './types';
import { alignJustify } from './utils';

/** Whether a date column narrows or reorders its list: a range is set, or the direction is not the list's own. */
export function isDateFilterApplied(filter: DataTableDateFilter): boolean {
  return filter.range?.from !== undefined || filter.sortDirection !== (filter.defaultSortDirection ?? 'desc');
}

const MENU_ALIGN = { left: 'start', center: 'center', right: 'end' } as const;

export interface DataTableDateFilterHeaderProps {
  filter: DataTableDateFilter;
  label: string;
  align?: 'left' | 'center' | 'right';
}

/**
 * The grid header cell of a date column (`meta.dateFilter`): the label and a calendar, one trigger as wide as the
 * cell, opening the date menu. It reads as the filter header beside it does: the label stays grey until the control is
 * applied, then turns primary and the glyph takes the accent. The menu is portalled, so the header's clipping
 * viewport does not cut it.
 */
export function DataTableDateFilterHeader({ filter, label, align = 'left' }: DataTableDateFilterHeaderProps) {
  const applied = isDateFilterApplied(filter);
  return (
    <DateFilterMenu
      mode="range"
      sort={filter.sortDirection}
      defaultSort={filter.defaultSortDirection}
      range={filter.range}
      onApply={filter.onApply}
      align={MENU_ALIGN[align]}
      trigger={
        <button
          type="button"
          data-grid-date-filter
          data-applied={applied || undefined}
          className={cn(
            'flex h-12 w-full cursor-pointer select-none items-center gap-[var(--spacing-system-xsf)] outline-none focus-visible:ring-1 focus-visible:ring-ods-accent',
            alignJustify(align),
          )}
        >
          <span
            className={cn('whitespace-nowrap text-h5', applied ? 'text-ods-text-primary' : 'text-ods-text-secondary')}
          >
            {label}
          </span>
          <CalendarIcon className={cn('h-4 w-4 shrink-0', applied ? 'text-ods-accent' : 'text-ods-text-secondary')} />
          {/* Appended to the visible label, not an `aria-label` in its place: the button's name still starts with the
              column's (WCAG 2.5.3, Label in Name). The comma keeps the two apart where the name is read as one run. */}
          <span className="sr-only">, sort and filter by date</span>
        </button>
      }
    />
  );
}

'use client';

/**
 * Shared filter section wrapper with responsive layout.
 *
 * Provides the consistent card container for any filter row (status,
 * platform, section, etc.) Single row on desktop with flex-wrap,
 * stacks naturally on mobile.
 *
 * Lifted from hub `components/admin/shared/filter-section.tsx` so
 * lib catalog views can render their own filter pills without an
 * injected slot.
 */

import { Filter } from '../icons-v2';
import type { ReactNode } from 'react';
import { InteractiveSkeleton, TextLineSkeleton } from '../loading/unified-skeleton';
import { Button } from './button';
import { useLoadingScope } from './loading-scope';

export interface FilterPillRowOption {
  value: string;
  label: string;
}

export interface FilterPillRowProps {
  /** Label shown next to the filter icon, e.g. "Section", "Platform". */
  label: string;
  /** The currently selected filter value. */
  selectedValue: string;
  /** Callback when a filter option is selected. */
  onValueChange: (value: string) => void;
  /** Available filter options. */
  options: FilterPillRowOption[];
  /** Optional count label, e.g. "Showing 1-10 of 42 items". */
  countLabel?: string;
  /** Optional children to render instead of options (for custom filter content). */
  children?: ReactNode;
  /** The options are read on the client and have not arrived: the row draws its skeleton, as in a loading scope. */
  loading?: boolean;
}

/** The row's shell, label and count line, read by the row and by its skeleton, so the skeleton is the row's box. */
const FILTER_ROW_CLASS = 'flex flex-wrap items-center gap-3 rounded-lg border border-ods-border bg-ods-card p-4';
const FILTER_COUNT_CLASS = 'ml-auto shrink-0 text-ods-text-secondary text-h6';
/** The pill's button size, read by the pill and by its skeleton (`InteractiveSkeleton.Button size`). */
const FILTER_PILL_SIZE = 'small-legacy';

function FilterPillRowFrame({ label, children, inert }: { label: string; children: ReactNode; inert?: boolean }) {
  return (
    <div className={FILTER_ROW_CLASS} aria-hidden={inert || undefined} inert={inert || undefined}>
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-ods-accent" />
        <span className="text-ods-text-secondary text-h5">{label}</span>
      </div>
      {children}
    </div>
  );
}

function FilterPill({ label, selected, onClick }: { label: string; selected: boolean; onClick?: () => void }) {
  return (
    <Button
      type="button"
      variant={selected ? 'accent' : 'outline'}
      size={FILTER_PILL_SIZE}
      onClick={onClick}
      tabIndex={onClick ? undefined : -1}
      className="text-h3"
    >
      {label}
    </Button>
  );
}

export function FilterPillRow({
  label,
  selectedValue,
  onValueChange,
  options,
  countLabel,
  children,
  loading = false,
}: FilterPillRowProps) {
  // In a page's loading state the row is its skeleton: options the page states are its own words (drawn for
  // real), read ones arrive empty (boxes), and a count label is read data (a bar).
  if ((useLoadingScope() || loading) && !children) {
    return (
      <FilterPillRowSkeleton
        label={label}
        options={options.length > 0 ? options.map(opt => opt.label) : undefined}
        count={countLabel !== undefined}
      />
    );
  }
  return (
    <FilterPillRowFrame label={label}>
      {children ||
        options.map(opt => (
          <FilterPill
            key={opt.value}
            label={opt.label}
            selected={selectedValue === opt.value}
            onClick={() => onValueChange(opt.value)}
          />
        ))}
      {countLabel && <div className={FILTER_COUNT_CLASS}>{countLabel}</div>}
    </FilterPillRowFrame>
  );
}

/**
 * The loading state of a SERVED pill row (facets that arrive with the data):
 * the same row shell, its label real, the `options` it states as real pills,
 * else `pills` boxes of a pill's size, so the filters never pop in under the
 * content. With `count` the count line is a bar.
 */
export function FilterPillRowSkeleton({
  label,
  options,
  pills = 5,
  count = false,
}: {
  label: string;
  /** Option labels the page states itself: real pills in place of the boxes. */
  options?: string[];
  pills?: number;
  count?: boolean;
}) {
  return (
    <FilterPillRowFrame label={label} inert>
      {options
        ? options.map(option => <FilterPill key={option} label={option} selected={false} />)
        : Array.from({ length: pills }, (_, i) => <InteractiveSkeleton.Button key={i} size={FILTER_PILL_SIZE} />)}
      {count && (
        <div className={FILTER_COUNT_CLASS}>
          <TextLineSkeleton type="h6" className="w-40" />
        </div>
      )}
    </FilterPillRowFrame>
  );
}


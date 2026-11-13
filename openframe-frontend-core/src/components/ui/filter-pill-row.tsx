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

import { Filter } from 'lucide-react';
import type { ReactNode } from 'react';
import { InteractiveSkeleton, TextLineSkeleton } from '../loading/unified-skeleton';
import { Button } from './button';
import { useLoadingScope } from './loading-scope';

export interface FilterPillRowOption {
  value: string;
  label: string;
  /**
   * How many records the option holds, drawn as "Label (n)". `null` while it is read: the pill keeps the count's
   * place (a bar), so the pills do not widen and rewrap when the counts land. Leave it out for a pill with no count.
   */
  count?: number | null;
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

/** A count's place in a pill while it is read: about three digits and the brackets. */
const FILTER_PILL_COUNT_SKELETON_CLASS = 'ml-1 inline-block w-8 align-middle';

function FilterPill({
  label,
  count,
  selected,
  onClick,
}: {
  label: string;
  count?: number | null;
  selected: boolean;
  onClick?: () => void;
}) {
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
      {count === null ? (
        <span className={FILTER_PILL_COUNT_SKELETON_CLASS}>
          <TextLineSkeleton type="inherit" />
        </span>
      ) : count !== undefined ? (
        ` (${count})`
      ) : null}
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
        options={options.length > 0 ? options : undefined}
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
            count={opt.count}
            selected={selectedValue === opt.value}
            onClick={() => onValueChange(opt.value)}
          />
        ))}
      {countLabel && <div className={FILTER_COUNT_CLASS}>{countLabel}</div>}
    </FilterPillRowFrame>
  );
}

/** Pill boxes a loading row draws when the page states no options: a typical facet. */
const FILTER_PILL_ROW_SKELETON_PILLS = 5;

/**
 * The loading state of a SERVED pill row (facets that arrive with the data):
 * the same row shell, its label real, the `options` it states as real pills,
 * else `pills` boxes of a pill's size, so the filters never pop in under the
 * content. With `count` the count line is a bar.
 */
function FilterPillRowSkeleton({
  label,
  options,
  pills = FILTER_PILL_ROW_SKELETON_PILLS,
  count = false,
}: {
  label: string;
  /** Options the page states itself: real pills in place of the boxes (a count, read data, is its bar). */
  options?: FilterPillRowOption[];
  pills?: number;
  count?: boolean;
}) {
  return (
    <FilterPillRowFrame label={label} inert>
      {options
        ? options.map(option => (
            <FilterPill key={option.value} label={option.label} count={option.count === undefined ? undefined : null} selected={false} />
          ))
        : Array.from({ length: pills }, (_, i) => <InteractiveSkeleton.Button key={i} size={FILTER_PILL_SIZE} />)}
      {count && (
        <div className={FILTER_COUNT_CLASS}>
          <TextLineSkeleton type="h6" className="w-40" />
        </div>
      )}
    </FilterPillRowFrame>
  );
}

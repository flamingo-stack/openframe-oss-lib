'use client';

import { Filter } from 'lucide-react';
import { cn } from '../../utils/cn';
import { InteractiveSkeleton, TextLineSkeleton } from '../loading/unified-skeleton';
import { Button } from '../ui/button';
import { useLoadingScope } from '../ui/loading-scope';

export interface StatusOption {
  value: string;
  label: string;
}

export interface StatusFilterComponentProps {
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  statusOptions: StatusOption[];
  showCount?: boolean;
  count?: number;
  className?: string;
  /** Status values (incl. `'all'`) to render but DISABLE — the buttons stay
   *  visible (so the full set is always shown) but are non-clickable. Lets a
   *  dashboard expose every status while gating which ones a given viewer may
   *  actually select (e.g. non-management can only pick `published`). */
  disabledValues?: string[];
  /**
   * Row label. Defaults to `Status`, so every existing call site is unchanged.
   *
   * Set it to reuse this row for any other single-select facet (Discipline,
   * Level, …) instead of hand-rolling a look-alike: a duplicated row renders
   * markup identical to this one, and React then pairs the copy against this
   * component during hydration and reports a mismatch on the label text.
   */
  label?: string;
  /**
   * Render the built-in "All" clear-selection button (default true). Turn it
   * off for facets with no all-of-them state — e.g. a View toggle
   * (Everyone / My Sessions), where one option is always selected. Added so
   * those rows reuse THIS component instead of hand-rolling identical markup
   * (which React then pairs against this component during hydration).
   */
  showAll?: boolean;
  /** The options are read on the client and have not arrived: the row draws its skeleton, as in a loading scope. */
  loading?: boolean;
}

/** The row's frame, label and controls, read by the row and by its skeleton, so the skeleton is the row's size. */
const STATUS_FILTER_ROW_CLASS = 'flex flex-wrap items-center gap-3 rounded-lg border border-ods-border bg-ods-card p-4';
const STATUS_FILTER_LABEL_CLASS = 'flex items-center gap-2';
const STATUS_FILTER_ICON_CLASS = 'h-4 w-4 text-ods-accent';
const STATUS_FILTER_LABEL_TEXT_CLASS = 'text-ods-text-secondary text-h5';
/** The option buttons' type, read by the row and by its skeleton. */
const STATUS_FILTER_BUTTON_CLASS = 'text-h3';
const STATUS_FILTER_COUNT_CLASS = 'ml-auto shrink-0 text-ods-text-secondary text-h6';
/** The option buttons' size, read by the row and by its skeleton (`InteractiveSkeleton.Button size`). */
const STATUS_FILTER_BUTTON_SIZE = 'small-legacy';
/** How many option buttons the skeleton draws when the options are read with the page. */
export const STATUS_FILTER_SKELETON_PILLS = 3;

/**
 * StatusFilterComponent - Reusable status filter for admin dashboards
 *
 * Displays a row of status filter buttons matching the blog posts dashboard pattern
 */
export function StatusFilterComponent({
  selectedStatus,
  onStatusChange,
  statusOptions,
  showCount = false,
  count = 0,
  className = '',
  disabledValues = [],
  label = 'Status',
  showAll = true,
  loading = false,
}: StatusFilterComponentProps) {
  // Filter out 'all' from options since we render it separately
  const filteredOptions = statusOptions.filter(option => option.value !== 'all');

  if (useLoadingScope() || loading) {
    return (
      <StatusFilterComponentSkeleton
        label={label}
        // Options the page states itself are its own words: drawn for real. Read ones arrive empty: boxes.
        options={filteredOptions.length > 0 ? filteredOptions.map(option => option.label) : undefined}
        showAll={showAll}
        showCount={showCount}
        className={className}
      />
    );
  }

  return (
    <div className={`${STATUS_FILTER_ROW_CLASS} ${className}`}>
      <div className={STATUS_FILTER_LABEL_CLASS}>
        <Filter className={STATUS_FILTER_ICON_CLASS} />
        <span className={STATUS_FILTER_LABEL_TEXT_CLASS}>{label}</span>
      </div>

      {/* All button */}
      {showAll && (
        <Button
          type="button"
          variant={selectedStatus === 'all' ? 'accent' : 'outline'}
          size={STATUS_FILTER_BUTTON_SIZE}
          onClick={() => onStatusChange('all')}
          disabled={disabledValues.includes('all')}
          className={STATUS_FILTER_BUTTON_CLASS}
        >
          All
        </Button>
      )}

      {/* Status option buttons */}
      {filteredOptions.map(option => (
        <Button
          key={option.value}
          type="button"
          variant={selectedStatus === option.value ? 'accent' : 'outline'}
          size={STATUS_FILTER_BUTTON_SIZE}
          onClick={() => onStatusChange(option.value)}
          disabled={disabledValues.includes(option.value)}
          className={STATUS_FILTER_BUTTON_CLASS}
        >
          {option.label}
        </Button>
      ))}

      {/* Optional count display */}
      {showCount && <div className={STATUS_FILTER_COUNT_CLASS}>{count} items</div>}
    </div>
  );
}

/**
 * The status filter while its page is read: the same row, its label and "All" for real (the row's own words), the
 * `options` the page states for real, else `pills` option buttons as boxes of the buttons' size. With `showCount`
 * the count is a bar before "items".
 */
export function StatusFilterComponentSkeleton({
  label = 'Status',
  options,
  pills = STATUS_FILTER_SKELETON_PILLS,
  showAll = true,
  showCount = false,
  className,
}: {
  label?: string;
  /** Option labels the page states itself: drawn as real buttons (in place of `pills` boxes). */
  options?: string[];
  pills?: number;
  showAll?: boolean;
  showCount?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(STATUS_FILTER_ROW_CLASS, className)} aria-hidden inert>
      <div className={STATUS_FILTER_LABEL_CLASS}>
        <Filter className={STATUS_FILTER_ICON_CLASS} />
        <span className={STATUS_FILTER_LABEL_TEXT_CLASS}>{label}</span>
      </div>
      {showAll && (
        <Button
          type="button"
          variant="outline"
          size={STATUS_FILTER_BUTTON_SIZE}
          className={STATUS_FILTER_BUTTON_CLASS}
          tabIndex={-1}
        >
          All
        </Button>
      )}
      {options
        ? options.map(option => (
            <Button
              key={option}
              type="button"
              variant="outline"
              size={STATUS_FILTER_BUTTON_SIZE}
              className={STATUS_FILTER_BUTTON_CLASS}
              tabIndex={-1}
            >
              {option}
            </Button>
          ))
        : Array.from({ length: pills }, (_, index) => (
            <InteractiveSkeleton.Button key={index} size={STATUS_FILTER_BUTTON_SIZE} />
          ))}
      {showCount && (
        <div className={STATUS_FILTER_COUNT_CLASS}>
          <TextLineSkeleton type="inherit" as="span" className="inline-block w-6 align-top" /> items
        </div>
      )}
    </div>
  );
}

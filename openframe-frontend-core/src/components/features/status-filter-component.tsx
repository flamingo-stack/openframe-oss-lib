"use client";

import React from 'react';
import { Filter } from 'lucide-react';
import { Button } from '../ui/button';

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
}

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
  showAll = true
}: StatusFilterComponentProps) {
  // Filter out 'all' from options since we render it separately
  const filteredOptions = statusOptions.filter(option => option.value !== 'all');

  return (
    <div className={`flex flex-wrap items-center gap-3 p-4 bg-ods-card border border-ods-border rounded-lg ${className}`}>
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-ods-accent" />
        <span className="text-h5 text-ods-text-secondary">
          {label}
        </span>
      </div>

      {/* All button */}
      {showAll && (
      <Button
        type="button"
        variant={selectedStatus === 'all' ? "accent" : "outline"}
        size="small-legacy"
        onClick={() => onStatusChange('all')}
        disabled={disabledValues.includes('all')}
        className="text-h3"
      >
        All
      </Button>
      )}

      {/* Status option buttons */}
      {filteredOptions.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={selectedStatus === option.value ? "accent" : "outline"}
          size="small-legacy"
          onClick={() => onStatusChange(option.value)}
          disabled={disabledValues.includes(option.value)}
          className="text-h3"
        >
          {option.label}
        </Button>
      ))}

      {/* Optional count display */}
      {showCount && (
        <div className="ml-auto text-h6 text-ods-text-secondary shrink-0">
          {count} items
        </div>
      )}
    </div>
  );
}

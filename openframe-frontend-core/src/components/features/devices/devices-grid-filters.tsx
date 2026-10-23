'use client';

import { cn } from '../../../utils/cn';
import { Filter02Icon } from '../../icons-v2-generated';
import { Button } from '../../ui/button';
import { FiltersDropdown } from '../filters-dropdown';
import type { DeviceFilterColumn } from './devices-table-columns';

export interface DevicesGridFiltersProps {
  filterColumns: DeviceFilterColumn[];
  /** Current filter values keyed by column id (same shape as table's tableFilters). */
  currentFilters: Record<string, string[]>;
  /** Called with the next filters Record on apply/reset. Should write to URL params. */
  onFilterChange: (filters: Record<string, string[]>) => void;
  /** Server-side count for the "N results" tail. */
  totalCount?: number;
  /**
   * The facet query is still out. Keeps every filterable column in the row even
   * though its options haven't arrived, the LABELS are static, so the row can
   * be drawn at its real height instead of collapsing to nothing and pushing the
   * grid down a row the moment the facets land. Used by the panel's Suspense
   * fallback, which renders this inert.
   */
  isLoading?: boolean;
}

/**
 * DevicesGridFilters, horizontal row of dropdown filters shown above the
 * devices grid. Mirrors the column-header filters from the table view so the
 * same filter set is available in both layouts.
 */
export function DevicesGridFilters({
  filterColumns,
  currentFilters,
  onFilterChange,
  totalCount,
  isLoading = false,
}: DevicesGridFiltersProps) {
  const filterableColumns = filterColumns.filter(
    c => c.filterable && (isLoading || (c.filterOptions && c.filterOptions.length > 0)),
  );

  if (filterableColumns.length === 0 && totalCount === undefined) {
    return null;
  }

  return (
    <div className="sticky top-[96px] z-10 flex flex-wrap items-start gap-[var(--spacing-system-m)] bg-ods-bg px-[var(--spacing-system-m)]">
      {filterableColumns.map(column => {
        const selected = currentFilters[column.key] ?? [];
        const active = selected.length > 0;

        return (
          <FiltersDropdown
            key={column.key}
            triggerElement={
              <Button
                variant="link"
                size="compact"
                noPaddingX
                type="button"
                data-tone="neutral"
                aria-label={`Filter by ${column.label}`}
              >
                <span className="select-none whitespace-nowrap uppercase text-h5">{column.label}</span>
                <Filter02Icon className={cn(active && 'text-ods-accent')} />
              </Button>
            }
            sections={[
              {
                id: column.key,
                title: column.label,
                type: 'checkbox',
                options: column.filterOptions ?? [],
                allowSelectAll: true,
              },
            ]}
            currentFilters={{ [column.key]: selected }}
            onApply={applied => {
              const next = applied[column.key] ?? [];
              onFilterChange({ ...currentFilters, [column.key]: next });
            }}
            onReset={() => onFilterChange({ ...currentFilters, [column.key]: [] })}
            placement="bottom-start"
            dropdownClassName="min-w-60"
          />
        );
      })}
      {totalCount !== undefined && (
        <div className="absolute inset-y-0 right-0 flex items-center">
          <span className="whitespace-nowrap text-ods-text-secondary text-h6">{totalCount} results</span>
        </div>
      )}
    </div>
  );
}

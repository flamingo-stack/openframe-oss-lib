'use client';

import { cn } from '../../../utils/cn';
import { FiltersDropdown } from '../../features';
import { Filter02Icon } from '../../icons-v2-generated';
import type { FilterOption, TableFilters } from './types';

/** @deprecated Use `DataTableColumnFilter` from `data-table` instead. */
export interface TableColumnFilterDropdownProps {
  /** Column key used for filter state */
  columnKey: string;
  /** Column label for display and accessibility */
  columnLabel: string;
  /** Available filter options for the column */
  filterOptions: FilterOption[];
  /** Current filter state for all columns */
  filters?: TableFilters;
  /** Called when filters change */
  onFilterChange: (filters: TableFilters) => void;
  /** Dropdown placement */
  placement?: 'bottom-start' | 'bottom-end' | 'bottom';
  /** Additional class for the dropdown */
  dropdownClassName?: string;
}

/** @deprecated Use `DataTableColumnFilter` from `data-table` instead. */
export function TableColumnFilterDropdown({
  columnKey,
  columnLabel,
  filterOptions,
  filters,
  onFilterChange,
  placement = 'bottom-start',
  dropdownClassName = 'min-w-[240px]',
}: TableColumnFilterDropdownProps) {
  const activeCount = filters?.[columnKey]?.length || 0;

  return (
    <FiltersDropdown
      triggerElement={
        <div
          className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 transition-all duration-200 hover:bg-ods-bg-active"
          aria-label={`Filter by ${columnLabel}`}
        >
          <span className="select-none text-ods-text-secondary text-h5">{columnLabel}</span>
          <Filter02Icon
            className={cn('h-4 w-4 transition-colors', activeCount > 0 ? 'text-ods-accent' : 'text-ods-text-secondary')}
          />
        </div>
      }
      sections={[
        {
          id: columnKey,
          title: columnLabel,
          type: 'checkbox',
          options: filterOptions,
          allowSelectAll: true,
        },
      ]}
      onApply={appliedFilters => {
        onFilterChange({
          ...filters,
          [columnKey]: appliedFilters[columnKey] || [],
        });
      }}
      onReset={() => {
        const newFilters = { ...filters };
        delete newFilters[columnKey];
        onFilterChange(newFilters);
      }}
      currentFilters={{ [columnKey]: filters?.[columnKey] || [] }}
      placement={placement}
      dropdownClassName={dropdownClassName}
    />
  );
}

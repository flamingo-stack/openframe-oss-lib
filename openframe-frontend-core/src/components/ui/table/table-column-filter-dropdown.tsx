'use client'

import { cn } from '../../../utils/cn'
import { FiltersDropdown, type FilterSection } from '../../features'
import { Filter02Icon } from '@/components/icons-v2-generated'
import type { FilterOption, TableFilters } from './types'

export interface TableColumnFilterDropdownProps {
  /** Column key used for filter state */
  columnKey: string
  /** Column label for display and accessibility */
  columnLabel: string
  /** Available filter options for the column */
  filterOptions: FilterOption[]
  /** Current filter state for all columns */
  filters?: TableFilters
  /** Called when filters change */
  onFilterChange: (filters: TableFilters) => void
  /** Dropdown placement */
  placement?: 'bottom-start' | 'bottom-end' | 'bottom'
  /** Additional class for the dropdown */
  dropdownClassName?: string
}

export function TableColumnFilterDropdown({
  columnKey,
  columnLabel,
  filterOptions,
  filters,
  onFilterChange,
  placement = 'bottom-start',
  dropdownClassName = 'min-w-[240px]',
}: TableColumnFilterDropdownProps) {
  const activeCount = filters?.[columnKey]?.length || 0

  return (
    <FiltersDropdown
      triggerElement={
        <div
          className="flex items-center gap-1.5 rounded px-1 py-0.5 cursor-pointer hover:bg-ods-bg-active transition-all duration-200"
          aria-label={`Filter by ${columnLabel}`}
        >
          <span className="font-medium text-[12px] leading-[16px] uppercase text-ods-text-secondary select-none">
            {columnLabel}
          </span>
          <Filter02Icon
            className={cn(
              'w-4 h-4 transition-colors',
              activeCount > 0
                ? 'text-ods-accent'
                : 'text-ods-text-secondary',
            )}
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
        } as FilterSection,
      ]}
      onApply={(appliedFilters) => {
        onFilterChange({
          ...filters,
          [columnKey]: appliedFilters[columnKey] || [],
        })
      }}
      onReset={() => {
        const newFilters = { ...filters }
        delete newFilters[columnKey]
        onFilterChange(newFilters)
      }}
      currentFilters={{ [columnKey]: filters?.[columnKey] || [] }}
      placement={placement}
      dropdownClassName={dropdownClassName}
    />
  )
}

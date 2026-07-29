'use client'

import { useCallback, useMemo } from 'react'
import type { Column } from '@tanstack/react-table'
import { cn } from '../../../utils/cn'
import { Filter02Icon } from '../../icons-v2-generated'
import { FiltersDropdown, type FilterSection } from '../../features'
import type { DataTableFilterOption } from './types'
import { alignJustify } from './utils'

// Stable reference for "no filter selected" — avoids creating a new `[]` per
// render when `column.getFilterValue()` is `undefined`, which would otherwise
// invalidate `currentFilters` useMemo every render.
const EMPTY_ARRAY: string[] = []

export interface DataTableColumnFilterProps {
  column: Column<unknown, unknown>
  options: DataTableFilterOption[]
  placement?: 'bottom-start' | 'bottom-end' | 'bottom'
  label: string
  align?: 'left' | 'center' | 'right'
}

/** Filter dropdown wrapper that reads/writes TanStack column filter state. */
export function DataTableColumnFilter({
  column,
  options,
  placement = 'bottom-start',
  label,
  align = 'left',
}: DataTableColumnFilterProps) {
  const currentValue = column.getFilterValue() as string[] | undefined
  const activeCount = currentValue?.length ?? 0

  const sections = useMemo<FilterSection[]>(
    () => [
      {
        id: column.id,
        title: label,
        type: 'checkbox',
        options,
        allowSelectAll: true,
      },
    ],
    [column.id, label, options],
  )

  const currentFilters = useMemo(
    () => ({ [column.id]: currentValue ?? EMPTY_ARRAY }),
    [column.id, currentValue],
  )

  const handleApply = useCallback(
    (applied: Record<string, string[]>) => {
      const next = applied[column.id] ?? []
      column.setFilterValue(next.length > 0 ? next : undefined)
    },
    [column],
  )

  const handleReset = useCallback(() => {
    column.setFilterValue(undefined)
  }, [column])

  return (
    <FiltersDropdown
      className="!block w-full"
      triggerElement={
        <div
          className={cn(
            // Fixed 48px per design, same as the plain header cell next to it —
            // NOT padding around the label. The two were drifting: 12px+20px+12px
            // came out 44px here while the sibling was pinned to 48, so in a
            // header mixing filterable and plain columns the labels sat on
            // different centre lines and the filter's hit area was 4px short of
            // the row it belongs to.
            'group flex w-full items-center gap-[var(--spacing-system-xsf)] h-12 rounded-sm cursor-pointer transition-colors duration-200 select-none',
            alignJustify(align),
          )}
          aria-label={`Filter by ${label}`}
        >
          <span className="text-h5 text-ods-text-secondary whitespace-nowrap transition-colors duration-200 group-hover:text-ods-text-primary">
            {label}
          </span>
          <Filter02Icon
            className={cn(
              'w-4 h-4 transition-colors',
              activeCount > 0 ? 'text-ods-accent' : 'text-ods-text-secondary group-hover:text-ods-text-primary',
            )}
          />
        </div>
      }
      sections={sections}
      currentFilters={currentFilters}
      onApply={handleApply}
      onReset={handleReset}
      placement={placement}
      dropdownClassName="min-w-60"
    />
  )
}

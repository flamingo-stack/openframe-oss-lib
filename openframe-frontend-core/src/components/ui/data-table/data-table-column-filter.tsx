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
  /** Options are still loading — see `meta.filter.pending`. */
  pending?: boolean
}

/** Filter dropdown wrapper that reads/writes TanStack column filter state. */
export function DataTableColumnFilter({
  column,
  options,
  placement = 'bottom-start',
  label,
  align = 'left',
  pending = false,
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

  // Nothing to choose from. Two ways to get here, and they look different:
  //
  //  - `pending`: the options are in flight. The funnel is drawn but inert, so
  //    it does not appear out of nowhere when the query answers — the state a
  //    skeleton, or a table whose facets load separately from its rows, asks for.
  //  - otherwise: there are no options and there will be none. No funnel: a
  //    control that cannot be opened reads as a broken one, and the design shows
  //    the bare label. `meta.filter` still being declared is what keeps the
  //    header cell alive on tablet (below `lg` only filterable cells show) and
  //    keeps its 48px box — only the glyph goes.
  const isEmpty = options.length === 0

  const trigger = (
    <div
      className={cn(
        // Fixed 48px per design, same as the plain header cell next to it —
        // NOT padding around the label. The two were drifting: 12px+20px+12px
        // came out 44px here while the sibling was pinned to 48, so in a
        // header mixing filterable and plain columns the labels sat on
        // different centre lines and the filter's hit area was 4px short of
        // the row it belongs to.
        'group flex w-full items-center gap-[var(--spacing-system-xsf)] h-12 rounded-sm transition-colors duration-200 select-none',
        alignJustify(align),
        isEmpty ? 'cursor-default' : 'cursor-pointer',
      )}
      // Only a real control announces itself as one. With no options this box
      // is the plain header label the non-filterable columns beside it render.
      aria-label={isEmpty ? undefined : `Filter by ${label}`}
    >
      <span
        className={cn(
          'text-h5 text-ods-text-secondary whitespace-nowrap transition-colors duration-200',
          !isEmpty && 'group-hover:text-ods-text-primary',
        )}
      >
        {label}
      </span>
      {/* Kept while PENDING — it holds its own width, so the label does not
          shift sideways the moment the options resolve — and dropped once we
          know there are none. */}
      {(!isEmpty || pending) && (
        <Filter02Icon
          className={cn(
            'w-4 h-4 transition-colors',
            activeCount > 0 && 'text-ods-accent',
            activeCount === 0 && 'text-ods-text-secondary',
            activeCount === 0 && !isEmpty && 'group-hover:text-ods-text-primary',
          )}
        />
      )}
    </div>
  )

  // Same box, no dropdown: opening onto an empty list would be a worse answer
  // than not opening at all.
  if (isEmpty) {
    return <div className="block w-full">{trigger}</div>
  }

  return (
    <FiltersDropdown
      className="!block w-full"
      triggerElement={trigger}
      sections={sections}
      currentFilters={currentFilters}
      onApply={handleApply}
      onReset={handleReset}
      placement={placement}
      dropdownClassName="min-w-60"
    />
  )
}

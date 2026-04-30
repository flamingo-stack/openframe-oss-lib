'use client'

import type { ReactNode } from 'react'
import { flexRender, type Header } from '@tanstack/react-table'
import { useLgUp } from '../../../hooks/ui/use-media-query'
import { cn } from '../../../utils/cn'
import {
  Arrow01DownIcon,
  Arrow01UpIcon,
  SwitchVrIcon,
} from '../../icons-v2-generated'
import { DataTableColumnFilter } from './data-table-column-filter'
import { useDataTableContext } from './data-table'
import { alignJustify, getHideClasses } from './utils'

/** Single-column sort descriptor consumed by the header. */
export interface DataTableSortState {
  id: string
  desc: boolean
}

export interface DataTableHeaderProps {
  className?: string
  /** Keep the header visible while scrolling. */
  stickyHeader?: boolean
  /** Tailwind top class for sticky offset, e.g. `'top-[56px]'`. */
  stickyHeaderOffset?: string
  /**
   * Content rendered at the right edge of the header, on the same row as
   * column labels. Use for row-count, header-level toolbar buttons, etc.
   *
   * @example
   * <DataTable.Header rightSlot={<DataTable.RowCount itemName="device" />} />
   */
  rightSlot?: ReactNode
  /**
   * Current sort descriptor. The header only renders the direction indicator
   * based on this value — it doesn't own the state. Pair with `onSortChange`
   * and let the consumer decide what a click means (server query, in-memory
   * sort, TanStack's row-model sort, …).
   */
  sort?: DataTableSortState | null
  /**
   * Fires when a sortable column header is clicked. The consumer owns the
   * toggle cycle (e.g. none → asc → desc → none) and the actual data sort.
   */
  onSortChange?: (columnId: string) => void
}

export function DataTableHeader({
  className,
  stickyHeader,
  stickyHeaderOffset,
  rightSlot,
  sort = null,
  onSortChange,
}: DataTableHeaderProps) {
  const table = useDataTableContext()
  const isLgUp = useLgUp() ?? false

  // Flat header group (nested headers can be added later if needed).
  const headerGroup = table.getHeaderGroups()[0]
  if (!headerGroup) return null

  // On tablet (md, below lg), only filterable columns render. If none exist,
  // every HeaderCell returns null and the flex row collapses — which would
  // break the absolutely-positioned rightSlot. Detect that case and render
  // rightSlot in-flow instead.
  const hasVisibleHeaderCell = headerGroup.headers.some(header => {
    if (header.isPlaceholder) return false
    if (isLgUp) return true
    return Boolean(header.column.columnDef.meta?.filter)
  })

  return (
    <div
      className={cn(
        'hidden md:flex md:flex-col',
        stickyHeader && `sticky z-10 bg-ods-bg ${stickyHeaderOffset ?? 'top-0'}`,
        className,
      )}
    >
      <div className="flex items-stretch gap-[var(--spacing-system-mf)] px-[var(--spacing-system-mf)] relative">
        {headerGroup.headers.map(header => (
          <HeaderCell
            key={header.id}
            header={header}
            isLgUp={isLgUp}
            sort={sort}
            onSortChange={onSortChange}
          />
        ))}
        {rightSlot &&
          (hasVisibleHeaderCell ? (
            <div className="absolute right-[var(--spacing-system-mf)] inset-y-0 flex items-center">
              {rightSlot}
            </div>
          ) : (
            <div className="ml-auto flex items-center py-[var(--spacing-system-sf)]">
              {rightSlot}
            </div>
          ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────── internals ─────────────────────────────── */

type AnyHeader = Header<unknown, unknown>

interface HeaderCellProps {
  header: AnyHeader
  isLgUp: boolean
  sort: DataTableSortState | null
  onSortChange?: (columnId: string) => void
}

function HeaderCell({ header, isLgUp, sort, onSortChange }: HeaderCellProps) {
  if (header.isPlaceholder) return null

  const column = header.column
  const meta = column.columnDef.meta
  const hasFilter = Boolean(meta?.filter)
  const align = meta?.align ?? 'left'
  // Sort is opt-in via `meta.sortable`. Direction is fully consumer-driven via
  // the `sort` prop; we do not consult TanStack's sort APIs here.
  const canSort = meta?.sortable === true
  const sortDir: false | 'asc' | 'desc' =
    sort?.id === column.id ? (sort.desc ? 'desc' : 'asc') : false

  // Mobile (md, below lg): hide non-filter columns so only filters are accessible.
  if (!isLgUp && !hasFilter) return null

  return (
    <div
      className={cn(
        'flex items-stretch',
        isLgUp && (meta?.width || 'flex-1 min-w-0'),
        meta?.headerClassName,
        // Don't apply hide classes if column is filterable on tablet (keep filter accessible)
        !(hasFilter && !isLgUp) && getHideClasses(meta?.hideAt),
      )}
    >
      {hasFilter ? (
        <DataTableColumnFilter
          column={column}
          options={meta!.filter!.options}
          placement={meta!.filter!.placement}
          label={resolveHeaderLabel(header)}
          align={align}
        />
      ) : (
        <div
          className={cn(
            'flex w-full items-center gap-[var(--spacing-system-xsf)] py-[var(--spacing-system-sf)] rounded-sm select-none transition-colors duration-200',
            isLgUp && alignJustify(align),
            canSort && 'group cursor-pointer',
          )}
          onClick={canSort ? () => onSortChange?.(column.id) : undefined}
        >
          <HeaderLabel header={header} />
          {canSort && <SortIcon sorted={sortDir} />}
        </div>
      )}
    </div>
  )
}

function HeaderLabel({ header }: { header: AnyHeader }) {
  const headerDef = header.column.columnDef.header
  if (headerDef === undefined) return null
  if (typeof headerDef === 'string') {
    return (
      <span className="text-h5 text-ods-text-secondary uppercase whitespace-nowrap transition-colors duration-200 group-hover:text-ods-text-primary">
        {headerDef}
      </span>
    )
  }
  // Render-function or ReactNode: caller is responsible for styling.
  return <>{flexRender(headerDef, header.getContext())}</>
}

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <Arrow01UpIcon className="w-4 h-4 text-ods-accent" />
  if (sorted === 'desc') return <Arrow01DownIcon className="w-4 h-4 text-ods-accent" />
  return <SwitchVrIcon className="w-4 h-4 text-ods-text-secondary transition-colors duration-200 group-hover:text-ods-text-primary" />
}

function resolveHeaderLabel(header: AnyHeader): string {
  const h = header.column.columnDef.header
  return typeof h === 'string' ? h : header.column.id
}

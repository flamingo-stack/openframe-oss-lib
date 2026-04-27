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
}

export function DataTableHeader({
  className,
  stickyHeader,
  stickyHeaderOffset,
  rightSlot,
}: DataTableHeaderProps) {
  const table = useDataTableContext()
  const isLgUp = useLgUp() ?? false

  // Flat header group (nested headers can be added later if needed).
  const headerGroup = table.getHeaderGroups()[0]
  if (!headerGroup) return null

  return (
    <div
      className={cn(
        'hidden md:flex md:flex-col',
        stickyHeader && `sticky z-10 bg-ods-bg ${stickyHeaderOffset ?? 'top-0'}`,
        className,
      )}
    >
      <div className="flex items-center gap-[var(--spacing-system-mf)] px-[var(--spacing-system-mf)] py-[var(--spacing-system-sf)] relative h-11">
        {headerGroup.headers.map(header => (
          <HeaderCell key={header.id} header={header} isLgUp={isLgUp} />
        ))}
        {rightSlot && (
          <div className="absolute right-[var(--spacing-system-mf)] flex items-center">
            {rightSlot}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────── internals ─────────────────────────────── */

type AnyHeader = Header<unknown, unknown>

function HeaderCell({ header, isLgUp }: { header: AnyHeader; isLgUp: boolean }) {
  if (header.isPlaceholder) return null

  const column = header.column
  const meta = column.columnDef.meta
  const hasFilter = Boolean(meta?.filter)
  const align = meta?.align ?? 'left'

  // Mobile (md, below lg): hide non-filter columns so only filters are accessible.
  if (!isLgUp && !hasFilter) return null

  return (
    <div
      className={cn(
        'flex gap-[var(--spacing-system-xsf)] items-center',
        isLgUp && alignJustify(align),
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
        />
      ) : (
        <div
          className={cn(
            'flex gap-[var(--spacing-system-xsf)] items-center rounded-sm select-none transition-colors duration-200',
            column.getCanSort() && 'group cursor-pointer',
          )}
          onClick={column.getToggleSortingHandler()}
        >
          <HeaderLabel header={header} />
          {column.getCanSort() && <SortIcon sorted={column.getIsSorted()} />}
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

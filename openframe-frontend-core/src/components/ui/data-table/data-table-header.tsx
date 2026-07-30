'use client'

import type { ReactNode } from 'react'
import { flexRender, type Header } from '@tanstack/react-table'
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

  // Flat header group (nested headers can be added later if needed).
  const headerGroup = table.getHeaderGroups()[0]
  if (!headerGroup) return null

  // Below lg only filterable columns (and explicit opt-ins) are visible. If a table
  // has none, every cell is hidden there, the flex row has no height, and an
  // absolutely-positioned rightSlot has nothing to sit in — so that slot goes
  // in-flow instead. Derived from column META, never from the viewport: the same
  // answer on the server, on the first client paint and after, which is the whole
  // point of this file no longer reading a media query.
  const hasTabletVisibleCell = headerGroup.headers.some(header => {
    if (header.isPlaceholder) return false
    const meta = header.column.columnDef.meta
    return Boolean(meta?.filter) || meta?.alwaysShowHeader === true
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
          <HeaderCell key={header.id} header={header} sort={sort} onSortChange={onSortChange} />
        ))}
        {rightSlot && (
          <div
            className={cn(
              'flex items-center',
              hasTabletVisibleCell
                ? 'absolute right-[var(--spacing-system-mf)] inset-y-0'
                : // No cell is visible below lg, so there this slot is the only thing
                  // giving the row height and carries the same fixed 48 rather than
                  // padding out to 44. From lg the cells are back and it returns to
                  // the absolute placement.
                  'max-lg:ml-auto max-lg:h-12 lg:absolute lg:right-[var(--spacing-system-mf)] lg:inset-y-0',
            )}
          >
            {rightSlot}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────── internals ─────────────────────────────── */

type AnyHeader = Header<unknown, unknown>

interface HeaderCellProps {
  header: AnyHeader
  sort: DataTableSortState | null
  onSortChange?: (columnId: string) => void
}

/**
 * One header cell.
 *
 * Everything responsive here is a CSS class, deliberately. This used to branch on
 * `useLgUp() ?? false`, which answers `undefined` until an effect has run — so the
 * FIRST render (server included) took the "not lg" path on every viewport: each
 * non-filterable cell returned `null`, and the survivors rendered with no width and
 * no alignment. One frame later the real values arrived, so the header visibly
 * filled in and the columns snapped into place — while `DataTableRow` and
 * `DataTableSkeleton`, which have always used plain `hideAt` classes, were correct
 * from the start. Header and body therefore disagreed about which columns exist and
 * how wide they are for exactly one frame, which is the flicker-and-jump on every
 * table's load.
 */
function HeaderCell({ header, sort, onSortChange }: HeaderCellProps) {
  if (header.isPlaceholder) return null

  const column = header.column
  const meta = column.columnDef.meta
  const hasFilter = Boolean(meta?.filter)
  // Tablet visibility: filterable columns and explicit opt-ins stay rendered.
  const keepOnTablet = hasFilter || meta?.alwaysShowHeader === true
  const align = meta?.align ?? 'left'
  // Sort is opt-in via `meta.sortable`. Direction is fully consumer-driven via
  // the `sort` prop; we do not consult TanStack's sort APIs here.
  const canSort = meta?.sortable === true
  const sortDir: false | 'asc' | 'desc' =
    sort?.id === column.id ? (sort.desc ? 'desc' : 'asc') : false

  return (
    <div
      className={cn(
        'flex items-stretch',
        // Below lg only filterable columns and explicit opt-ins are shown, so the
        // others are hidden rather than dropped from the tree.
        !keepOnTablet && 'hidden lg:flex',
        // Width applies from lg only, as before — but stated as "always, neutralized
        // below lg" so it does not depend on knowing the viewport in JS. `max-lg:`
        // lands in a media query, so it wins there regardless of what `meta.width`
        // is (a fixed `w-[…]` or `flex-1 min-w-0`).
        meta?.width || 'flex-1 min-w-0',
        'max-lg:w-auto max-lg:flex-none max-lg:basis-auto',
        meta?.headerClassName,
        getHideClasses(meta?.hideAt),
        // A filterable column stays reachable below lg even if its `hideAt` would
        // hide it there; from lg the `hideAt` classes govern again.
        keepOnTablet && meta?.hideAt && 'max-lg:flex',
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
            // Fixed 48px header height per design (20px label centered inside)
            // instead of the padding-driven 44px.
            'flex w-full items-center gap-[var(--spacing-system-xsf)] h-12 rounded-sm select-none transition-colors duration-200',
            // Same "always, neutralized below lg" shape as the width above.
            alignJustify(align),
            'max-lg:justify-start',
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

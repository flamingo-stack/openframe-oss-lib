import type { FilterFn } from '@tanstack/react-table'
import type { TailwindBreakpoint } from './types'

/**
 * Generates Tailwind hide classes based on breakpoint configuration.
 *
 * @example
 * getHideClasses('md')           // 'hidden md:flex'
 * getHideClasses(['md', 'lg'])   // 'md:hidden lg:hidden xl:flex'
 */
export function getHideClasses(
  hideAt?: TailwindBreakpoint | TailwindBreakpoint[],
): string {
  if (!hideAt) return ''

  const breakpoints = Array.isArray(hideAt) ? hideAt : [hideAt]
  const order: TailwindBreakpoint[] = ['md', 'lg', 'xl', '2xl']

  if (breakpoints.length === 1) {
    return `hidden ${breakpoints[0]}:flex`
  }

  const maxIdx = Math.max(...breakpoints.map(bp => order.indexOf(bp)))
  const hideClasses = breakpoints.map(bp => `${bp}:hidden`).join(' ')
  const showBreakpoint = order[maxIdx + 1]
  return showBreakpoint ? `${hideClasses} ${showBreakpoint}:flex` : hideClasses
}

/** Maps `meta.align` to flex justify classes. */
export function alignJustify(align?: 'left' | 'center' | 'right'): string {
  switch (align) {
    case 'center':
      return 'justify-center text-center'
    case 'right':
      return 'justify-end text-right'
    default:
      return 'justify-start text-left'
  }
}

/**
 * Default `filterFn` for columns that use `meta.filter` with multi-select options.
 * Passes the row when the selected filter values contain the row's cell value.
 *
 * Use with `clientSideFiltering: true` on `useDataTable`. For server-side filtering
 * (Relay/REST), TanStack doesn't call `filterFn` at all — `manualFiltering` is on
 * and you translate `columnFilters` state into backend query variables yourself.
 *
 * @example
 * const columns: ColumnDef<Device>[] = [
 *   {
 *     accessorKey: 'status',
 *     header: 'Status',
 *     filterFn: multiSelectFilterFn,
 *     meta: { filter: { options: STATUS_OPTIONS } },
 *   },
 * ]
 */
export const multiSelectFilterFn: FilterFn<any> = (row, columnId, filterValue) => {
  const values = filterValue as Array<string | number | boolean> | undefined
  if (!values || values.length === 0) return true
  const cellValue = row.getValue(columnId)
  return values.some(v => v === cellValue || String(v) === String(cellValue))
}

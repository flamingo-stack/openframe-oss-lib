import type { FilterFn } from '@tanstack/react-table';
import type { TailwindBreakpoint } from './types';

/** Ascending breakpoint scale `hideAt` is expressed in. */
export const BREAKPOINT_ORDER: TailwindBreakpoint[] = ['md', 'lg', 'xl', '2xl'];

/**
 * Generates Tailwind hide classes based on breakpoint configuration.
 *
 * @example
 * getHideClasses('md')           // 'hidden content-md:flex'
 * getHideClasses(['md', 'lg'])   // 'content-md:hidden content-lg:hidden content-xl:flex'
 */
export function getHideClasses(hideAt?: TailwindBreakpoint | TailwindBreakpoint[]): string {
  if (!hideAt) return '';

  const breakpoints = Array.isArray(hideAt) ? hideAt : [hideAt];

  if (breakpoints.length === 1) {
    return `hidden content-${breakpoints[0]}:flex`;
  }

  const maxIdx = Math.max(...breakpoints.map(bp => BREAKPOINT_ORDER.indexOf(bp)));
  const hideClasses = breakpoints.map(bp => `content-${bp}:hidden`).join(' ');
  const showBreakpoint = BREAKPOINT_ORDER[maxIdx + 1];
  return showBreakpoint ? `${hideClasses} content-${showBreakpoint}:flex` : hideClasses;
}

/**
 * The visibility `getHideClasses(hideAt)` actually produces, evaluated per
 * breakpoint: `[base, md, lg, xl, 2xl]`.
 *
 * The header needs to *know* this rather than emit it, because its cells carry a
 * second rule on top (only filterable columns show below `lg`) and the two cannot
 * be layered as classes — Tailwind orders `max-*` media queries BEFORE `min-*`
 * ones, so a `max-lg:` override loses to any `md:`/`lg:` class it is meant to
 * cancel. Combining the two rules here, on plain booleans, sidesteps that
 * entirely: the header emits one unambiguous min-width ladder.
 *
 * Must stay in step with `getHideClasses` — the body rows and the skeleton apply
 * those classes directly, and a disagreement is a header that shows a different
 * set of columns than the rows beneath it.
 */
export function getHideAtVisibility(hideAt?: TailwindBreakpoint | TailwindBreakpoint[]): boolean[] {
  const steps = BREAKPOINT_ORDER.length + 1;
  if (!hideAt) return Array.from({ length: steps }, () => true);

  const breakpoints = Array.isArray(hideAt) ? hideAt : [hideAt];

  // Single breakpoint → `hidden <bp>:flex`: hidden below it, visible from it.
  if (breakpoints.length === 1) {
    const showFrom = BREAKPOINT_ORDER.indexOf(breakpoints[0]) + 1;
    return Array.from({ length: steps }, (_, step) => step >= showFrom);
  }

  // Array → one `<bp>:hidden` per entry plus a single `<next>:flex`, and no bare
  // `hidden`, so the base step stays visible. Walk the scale upwards: later
  // classes win, and the show breakpoint always sits past every hide one.
  const maxIdx = Math.max(...breakpoints.map(bp => BREAKPOINT_ORDER.indexOf(bp)));
  const showBreakpoint = BREAKPOINT_ORDER[maxIdx + 1];
  const visible = [true];
  for (const bp of BREAKPOINT_ORDER) {
    let state = visible[visible.length - 1];
    if (breakpoints.includes(bp)) state = false;
    if (bp === showBreakpoint) state = true;
    visible.push(state);
  }
  return visible;
}

/** Maps `meta.align` to flex justify classes. */
export function alignJustify(align?: 'left' | 'center' | 'right'): string {
  switch (align) {
    case 'center':
      return 'justify-center text-center';
    case 'right':
      return 'justify-end text-right';
    default:
      return 'justify-start text-left';
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
// Row-type-agnostic: only `row.getValue(columnId)` is touched, never a row
// field, so the filter is declared at the erased row type and works for any
// `ColumnDef<T>` it is attached to.
export const multiSelectFilterFn: FilterFn<unknown> = (row, columnId, filterValue) => {
  const values = filterValue as Array<string | number | boolean> | undefined;
  if (!values || values.length === 0) return true;
  const cellValue = row.getValue(columnId);
  return values.some(v => v === cellValue || String(v) === String(cellValue));
};

/** Skeleton rows of a table that knows no page size: a typical count for an UNPAGED table. */
export const DATA_TABLE_SKELETON_ROWS = 10;

/** The rows a next page's skeleton draws when neither the host nor the table states a page size. */
export const DATA_TABLE_NEXT_PAGE_SKELETON_ROWS = 3;

/**
 * The page size a host gave its table (`state.pagination.pageSize`, else `initialState.pagination.pageSize`), or
 * undefined when it gave none. Read from the OPTIONS, never `getState()`: TanStack fills in a page size of 10 for a
 * table that has no pagination at all, which is not a page this table loads.
 */
export function dataTablePageSize(table: {
  options: {
    state?: { pagination?: { pageSize?: number } };
    initialState?: { pagination?: { pageSize?: number } };
  };
}): number | undefined {
  const size = table.options.state?.pagination?.pageSize ?? table.options.initialState?.pagination?.pageSize;
  return size && size > 0 ? size : undefined;
}

/**
 * One page of rows still being read: the placeholders a table holds while it loads, which `DataTable.Body`'s
 * `loadingCells` draws with the REAL cells (every part of a cell drawing its own loading form). Each row is `fill(id)`
 * keyed `loading-<index>`: the fields a row requires, empty, so a cell reads nothing it could show.
 */
export function dataTableLoadingRows<T>(count: number, fill: (id: string) => T): T[] {
  return Array.from({ length: count }, (_, index) => fill(`loading-${index}`));
}

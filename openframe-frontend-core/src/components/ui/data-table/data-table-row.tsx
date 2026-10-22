'use client';

import { flexRender, type Row } from '@tanstack/react-table';
import type React from 'react';
import { memo, useCallback, useRef, type ReactNode } from 'react';
import Link from '../../../embed-shims/next-link';
import { cn } from '../../../utils/cn';
import { isOwnClick } from '../../../utils/own-click';
import { TextLineSkeleton } from '../../loading/unified-skeleton';
import { loadingItemProps, useLoadingScope } from '../loading-scope';
import { useDataTableContext } from './data-table';
import {
  DATA_TABLE_ROW_FRAME_CLASS,
  ROW_DESKTOP_SHELL_CLASS,
  ROW_HEIGHT_DESKTOP,
  ROW_HEIGHT_MOBILE,
  ROW_MOBILE_SHELL_CLASS,
  ROW_SHELL_CLASSES,
} from './data-table-row-classes';
import { alignJustify, getHideClasses } from './utils';

export interface DataTableRowProps<T> {
  /** The row. `null` is a row still being read (a body's loading rows): it draws its own skeleton, as it does in a
   *  loading scope. */
  row: Row<T> | null;
  onClick?: (item: T) => void;
  href?: string | null;
  /** Dense row height. */
  compact?: boolean;
  /**
   * REPLACES the height this row would otherwise take (`compact` or the design
   * default). The one place a table states how tall a row is, so
   * the pad rows and the skeleton can reserve the SAME number — see
   * `DataTableBodyProps.rowHeightClassName`.
   *
   * It sizes the row SLOT — the whole card — not the cells inside it. A row
   * with a `subRow` is taller than its cells, so sizing the cells would leave
   * the pad rows (which have no sub-row) short by exactly the sub-row: on a
   * phone board that was 96px per missing row.
   */
  rowHeightClassName?: string;
  className?: string;
  /** Expandable content rendered below the cells, inside the same card. */
  subRow?: ReactNode;
  /** A loading row's position in its list: every other row draws a second, secondary line under its first cell. */
  loadingIndex?: number;
  /** Classes on the loading row's cell shell (the skeleton's `rowClassName`). */
  cellsClassName?: string;
  /**
   * A placeholder row the host put in the table while it loads (`DataTable.Body`'s `loadingCells`): in the loading
   * scope it draws its REAL cells, each part drawing its own loading form, instead of the row's generic bars.
   */
  drawsCells?: boolean;
  /** `data-*` markers (`data-loading-item`: the body marks every row it draws), on the row's root in both forms. */
  [key: `data-${string}`]: unknown;
}

/**
 * One row of the table, loaded and loading. ONE switch: in a loading scope, or with `row={null}` (a body's loading
 * rows), it is its own {@link DataTableRowSkeleton}; the body never picks it.
 */
function DataTableRowSwitch<T>(props: DataTableRowProps<T>) {
  const inScope = useLoadingScope();
  if ((inScope || props.row === null) && !(props.drawsCells && props.row)) {
    return (
      <DataTableRowSkeleton
        index={props.loadingIndex ?? 0}
        compact={props.compact}
        rowHeightClassName={props.rowHeightClassName}
        className={typeof props.className === 'string' ? props.className : undefined}
        cellsClassName={props.cellsClassName}
        {...loadingItemProps(props)}
      />
    );
  }
  return <DataTableRowImpl {...props} row={props.row} />;
}

/**
 * A row while it is read: the row's own card and shells (`data-table-row-classes`), each visible column's cell a
 * `text-h4` bar (every other row a secondary `text-h6` line under the first cell), one stacked pair below `md`. One
 * row of the read list (`data-loading-item`), like the loaded row.
 */
function DataTableRowSkeleton({
  index,
  compact,
  rowHeightClassName,
  className,
  cellsClassName,
  ...props
}: {
  index: number;
  compact?: boolean;
  rowHeightClassName?: string;
  className?: string;
  cellsClassName?: string;
  [key: `data-${string}`]: unknown;
}) {
  const table = useDataTableContext();
  const columns = table.getVisibleFlatColumns();
  const firstColumnId = columns[0]?.id;
  // The loaded row's height rule: a stated slot height, else a dense row's padding, else the design height.
  const heightClass = (designHeight: string) =>
    rowHeightClassName ? 'h-full' : compact ? 'py-[var(--spacing-system-xsf)]' : designHeight;
  return (
    <div
      // Decoration: the table's own status line says it is loading.
      aria-hidden="true"
      {...loadingItemProps(props)}
      className={cn(DATA_TABLE_ROW_FRAME_CLASS, rowHeightClassName, className)}
    >
      <div
        className={cn(
          ROW_DESKTOP_SHELL_CLASS,
          !compact && 'py-0',
          ROW_SHELL_CLASSES,
          heightClass(ROW_HEIGHT_DESKTOP),
          cellsClassName,
        )}
      >
        {columns.map(column => {
          const meta = column.columnDef.meta;
          return (
            <div
              key={column.id}
              className={cn(
                'flex shrink-0 flex-col justify-center',
                meta?.width || 'flex-1',
                // Same responsive hiding the real header and row apply, so the columns are sized against one total.
                getHideClasses(meta?.hideAt),
              )}
            >
              <TextLineSkeleton type="h4" className="w-3/4" />
              {index % 2 === 0 && column.id === firstColumnId && <TextLineSkeleton type="h6" className="w-1/2" />}
            </div>
          );
        })}
      </div>
      <div
        className={cn(
          ROW_MOBILE_SHELL_CLASS,
          !compact && 'py-0',
          ROW_SHELL_CLASSES,
          heightClass(ROW_HEIGHT_MOBILE),
          cellsClassName,
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col justify-center py-[var(--spacing-system-sf)]">
          <TextLineSkeleton type="h4" className="w-3/4" />
          <TextLineSkeleton type="h6" className="w-1/2" />
        </div>
      </div>
    </div>
  );
}

/**
 * Click-bubbling protocol: any element inside a cell that should NOT trigger
 * `onRowClick` / row navigation must carry the `data-no-row-click` attribute.
 * The row checks `target.closest('[data-no-row-click]')` and short-circuits:
 * in `onClick` mode it skips the consumer's handler; in link mode (when
 * `href` is set) it calls `e.preventDefault()` so `<Link>` does not navigate.
 *
 * Clicks originating from portaled descendants (e.g. `FloatingTooltip`,
 * dropdown menus rendered through `FloatingPortal`) bubble through React's
 * component tree and reach this handler, but their DOM target lives outside
 * the row subtree. The handler ignores any click whose target is not
 * physically contained within the row element — no `stopPropagation`
 * required at the source.
 *
 * In link mode the row IS the `<Link>` — content lives inside it, not under
 * an absolute overlay — so native browser link behaviour works: hover,
 * right-click "Open in new tab", middle-click, `Cmd+click`, focus outlines,
 * `:visited` styles, etc.
 *
 * Example column with action buttons:
 * ```tsx
 * {
 *   id: 'actions',
 *   cell: ({ row }) => (
 *     <div data-no-row-click className="flex gap-2 justify-end">
 *       <Button onClick={() => edit(row.original)}>Edit</Button>
 *     </div>
 *   ),
 *   enableSorting: false,
 *   meta: { width: 'w-[160px] shrink-0', align: 'right' },
 * }
 * ```
 *
 * Wrapped in `React.memo` — for best perf in long lists, pass stable references
 * for `onClick` and `className` (if function) via `useCallback` / `useMemo` in
 * the consumer. `href` and string `className` are compared by value.
 */
function DataTableRowImpl<T>({
  row,
  onClick,
  href,
  compact,
  rowHeightClassName,
  className,
  subRow,
  drawsCells: _drawsCells,
  ...props
}: DataTableRowProps<T> & { row: Row<T> }) {
  const markers = loadingItemProps(props);
  const hasSubRow = subRow != null && subRow !== false;
  // A sub-row carries its own interactive controls, so it must not live inside the
  // row-level <Link>; when present, the link wraps only the cells.
  const isLinkMode = Boolean(href) && !onClick;
  const isWholeCardLink = isLinkMode && !hasSubRow;
  const containerRef = useRef<HTMLElement | null>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Not the row's own click (a portalled descendant, a `data-no-row-click` element): suppressed,
      // and in link mode `preventDefault` so `<Link>` does not navigate.
      if (!isOwnClick(e.target, containerRef.current)) {
        if (isLinkMode) e.preventDefault();
        return;
      }
      onClick?.(row.original);
    },
    [onClick, row.original, isLinkMode],
  );

  const containerClassName = cn(
    DATA_TABLE_ROW_FRAME_CLASS,
    'text-inherit no-underline',
    // A row fades in when it MOUNTS — so a loaded page eases in over the
    // skeleton it replaces instead of snapping, and rows that were already on
    // screen (keyed by id) do not replay it. Opacity only: nothing that moves
    // or resizes the slot, which is the whole point of the fixed row height.
    'duration-200 animate-in fade-in-0 motion-reduce:animate-none',
    // A stated slot height goes HERE, on the card, with the cells flexing to
    // fill whatever the sub-row leaves. `border-box` sizing means the number a
    // caller writes is the number the row occupies, borders included.
    rowHeightClassName ? `flex flex-col ${rowHeightClassName}` : 'block',
    // With a sub-row the link wraps only the cells, so keep the clickable affordance off the whole card.
    (onClick || isWholeCardLink) && 'cursor-pointer transition-colors hover:bg-ods-bg-active',
    className,
  );

  const cells = (
    <div
      className={cn(
        'flex',
        ROW_SHELL_CLASSES,
        rowHeightClassName
          ? 'min-h-0 flex-1 py-0'
          : compact
            ? 'py-[var(--spacing-system-xsf)]'
            : `py-0 ${ROW_HEIGHT_DESKTOP}`,
        // The divider under the cells is an inset shadow, not a border. The row
        // is a fixed border-box height, so a border takes its pixel out of the
        // content box and every centered cell moves up half a pixel the moment a
        // sub-row mounts, and back down when it unmounts — a visible twitch on
        // each expand and collapse. A shadow paints without touching layout.
        hasSubRow && 'shadow-[inset_0_-1px_0_0_var(--color-border-default)]',
      )}
    >
      {row.getVisibleCells().map(cell => {
        const meta = cell.column.columnDef.meta;
        return (
          <div
            key={cell.id}
            className={cn(
              'flex flex-col overflow-hidden',
              alignJustify(meta?.align),
              meta?.width || 'min-w-0 flex-1',
              meta?.cellClassName,
              getHideClasses(meta?.hideAt),
            )}
          >
            <CellContent>{flexRender(cell.column.columnDef.cell, cell.getContext())}</CellContent>
          </div>
        );
      })}
    </div>
  );

  if (isWholeCardLink && href) {
    return (
      <Link
        href={href}
        prefetch={false}
        ref={containerRef as React.RefObject<HTMLAnchorElement>}
        className={containerClassName}
        onClick={handleClick}
        {...markers}
      >
        {cells}
      </Link>
    );
  }

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className={containerClassName}
      onClick={onClick ? handleClick : undefined}
      // A row of a read list (the body marks it `data-loading-item`): how many there are is the record's.
      {...markers}
    >
      {isLinkMode && href ? (
        <Link
          href={href}
          prefetch={false}
          className={cn(
            'cursor-pointer text-inherit no-underline transition-colors hover:bg-ods-bg-active',
            rowHeightClassName ? 'flex min-h-0 flex-1 flex-col' : 'block',
          )}
          onClick={handleClick}
        >
          {cells}
        </Link>
      ) : (
        cells
      )}
      {hasSubRow && subRow}
    </div>
  );
}

export const DataTableRow = memo(DataTableRowSwitch) as typeof DataTableRowSwitch;

/** Wraps primitive string/number cell values in the default text style. */
function CellContent({ children }: { children: ReactNode }) {
  if (typeof children === 'string' || typeof children === 'number') {
    return (
      <span className="truncate text-ods-text-primary text-h4" title={String(children)}>
        {children}
      </span>
    );
  }
  return <>{children}</>;
}

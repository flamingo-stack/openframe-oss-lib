'use client';

import { flexRender, type Cell, type Row } from '@tanstack/react-table';
import type React from 'react';
import { memo, useCallback, useRef, type ReactNode } from 'react';
import Link from '../../../embed-shims/next-link';
import { cn } from '../../../utils/cn';
import { isOwnClick } from '../../../utils/own-click';
import { TextLineSkeleton } from '../../loading/unified-skeleton';
import { loadingItemProps, useLoadingScope } from '../loading-scope';
import { GRID_ROW_CLASS, gridCellClass, gridCellStyle, type GridColumn, type GridLayout } from './data-table-grid';

/** A control inside a row link whose click is its own: it never follows the row's link. */
const ROW_LINK_CONTROL_SELECTOR = 'button, [role="button"]';
/**
 * The selection cell. Its checkbox toggles on the click's way DOWN the tree like any control, but the row link's
 * navigation is cancelled on the way UP (by the cell itself): the checkbox skips its own toggle when the click arrives
 * already default-prevented, so the row's capture-phase cancel must leave it alone.
 */
const GRID_SELECT_SELECTOR = '[data-grid-select]';

/**
 * A row action in the grid is a bare 40px icon button (the design's `action-button`): the cell is its frame. Stated
 * on the cell, so a menu trigger or a button drawn with its own border and fill for the card rows loses them here.
 */
const GRID_ACTION_CELL_CLASS = '[&_button]:size-10 [&_button]:border-0 [&_button]:bg-transparent';

export interface DataTableGridRowProps<T> {
  /** The row. `null` is a row still being read: one 48px line of bars in the grid's own columns. */
  row: Row<T> | null;
  layout: GridLayout;
  onClick?: (item: T) => void;
  href?: string | null;
  /**
   * The row's selection, passed by the body. The row is memoised and the table keeps the same `Row` object when only
   * the selection changes, so without this prop a selection cell would not repaint.
   */
  selected?: boolean;
  /** Content drawn below the cells, as wide as the row. */
  subRow?: ReactNode;
  /** A placeholder row the host put in the table while it loads: it draws its real cells in the loading scope. */
  drawsCells?: boolean;
  [key: `data-${string}`]: unknown;
}

function DataTableGridRowSwitch<T>(props: DataTableGridRowProps<T>) {
  const inScope = useLoadingScope();
  if ((inScope || props.row === null) && !(props.drawsCells && props.row)) {
    return <DataTableGridRowSkeleton layout={props.layout} {...loadingItemProps(props)} />;
  }
  return <DataTableGridRowImpl {...props} row={props.row} />;
}

/** A grid row while it is read: the row's own boxes, a `text-h4` bar in every data cell. */
function DataTableGridRowSkeleton({ layout, ...props }: { layout: GridLayout; [key: `data-${string}`]: unknown }) {
  return (
    // Decoration: the table's own status line says it is loading.
    <div aria-hidden="true" {...loadingItemProps(props)} className={GRID_ROW_CLASS}>
      {layout.columns.map(column => (
        <div key={column.id} className={gridCellClass(column, 'body')} style={gridCellStyle(column)}>
          {column.kind === 'data' && <TextLineSkeleton type="h4" className="w-3/4" />}
        </div>
      ))}
    </div>
  );
}

function DataTableGridRowImpl<T>({
  row,
  layout,
  onClick,
  href,
  selected: _selected,
  subRow,
  drawsCells: _drawsCells,
  ...props
}: DataTableGridRowProps<T> & { row: Row<T> }) {
  const markers = loadingItemProps(props);
  const hasSubRow = subRow != null && subRow !== false;
  const isLinkMode = Boolean(href) && !onClick;
  // A sub-row carries its own controls, so it must not live inside the row's link: with one, the link wraps the cells.
  const isWholeRowLink = isLinkMode && !hasSubRow;
  const containerRef = useRef<HTMLElement | null>(null);

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      // Not the row's own click (a portalled descendant, a `data-no-row-click` element): suppressed, and in link mode
      // `preventDefault` so the link does not navigate.
      if (!isOwnClick(event.target, containerRef.current)) {
        if (isLinkMode) event.preventDefault();
        return;
      }
      onClick?.(row.original);
    },
    [onClick, row.original, isLinkMode],
  );

  // Link mode, CAPTURE phase: a click on a control inside the row link runs the control and never follows the link,
  // even when the control stops the click from bubbling. See `DataTableRow` for the full reasoning; the one
  // difference here is the selection cell (`GRID_SELECT_SELECTOR`).
  const preventControlNavigation = useCallback((event: React.MouseEvent) => {
    const container = containerRef.current;
    const target = event.target;
    if (!(target instanceof Element) || !container?.contains(target)) return;
    if (target.closest(GRID_SELECT_SELECTOR)) return;
    const nestedLink = target.closest('a');
    if (nestedLink && nestedLink !== container && container.contains(nestedLink)) return;
    if (!isOwnClick(target, container) || target.closest(ROW_LINK_CONTROL_SELECTOR)) event.preventDefault();
  }, []);

  const cellsById = new Map<string, Cell<T, unknown>>(row.getVisibleCells().map(cell => [cell.column.id, cell]));
  const cells = layout.columns.map(column => (
    <GridCell key={column.id} column={column} cell={cellsById.get(column.id)} />
  ));

  const rowClassName = cn(GRID_ROW_CLASS, 'group/gridrow text-inherit no-underline');
  const interactiveClassName = (onClick || isLinkMode) && 'cursor-pointer';

  if (isWholeRowLink && href) {
    return (
      <Link
        href={href}
        prefetch={false}
        ref={containerRef as React.RefObject<HTMLAnchorElement>}
        className={cn(rowClassName, interactiveClassName)}
        onClickCapture={preventControlNavigation}
        onClick={handleClick}
        {...markers}
      >
        {cells}
      </Link>
    );
  }

  if (!hasSubRow) {
    return (
      <div
        ref={containerRef as React.RefObject<HTMLDivElement>}
        className={cn(rowClassName, interactiveClassName)}
        onClick={onClick ? handleClick : undefined}
        {...markers}
      >
        {cells}
      </div>
    );
  }

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className="w-max min-w-full"
      onClick={onClick ? handleClick : undefined}
      {...markers}
    >
      {isLinkMode && href ? (
        <Link
          href={href}
          prefetch={false}
          className={cn(rowClassName, 'cursor-pointer')}
          onClickCapture={preventControlNavigation}
          onClick={handleClick}
        >
          {cells}
        </Link>
      ) : (
        <div className={cn(rowClassName, interactiveClassName)}>{cells}</div>
      )}
      <div className="border-b border-ods-border bg-ods-card">{subRow}</div>
    </div>
  );
}

export const DataTableGridRow = memo(DataTableGridRowSwitch) as typeof DataTableGridRowSwitch;

function GridCell<T>({ column, cell }: { column: GridColumn; cell: Cell<T, unknown> | undefined }) {
  const className = gridCellClass(column, 'body');
  const style = gridCellStyle(column);
  if (!cell || column.kind === 'filler') return <div className={className} style={style} />;

  const columnDef = cell.column.columnDef;
  const content = columnDef.meta?.gridCell
    ? columnDef.meta.gridCell(cell.getContext())
    : flexRender(columnDef.cell, cell.getContext());

  if (column.kind === 'select') {
    return (
      <div
        className={className}
        style={style}
        data-grid-select
        data-no-row-click
        // After the checkbox has toggled: the row link must not follow the click.
        onClick={event => event.preventDefault()}
      >
        {content}
      </div>
    );
  }
  if (column.kind === 'action') {
    return (
      <div className={cn(className, GRID_ACTION_CELL_CLASS)} style={style} data-no-row-click>
        {content}
      </div>
    );
  }
  return (
    <div className={cn(className, columnDef.meta?.cellClassName)} style={style} data-grid-col={column.id}>
      <CellContent>{content}</CellContent>
    </div>
  );
}

/** A plain string or number cell: the default one-line text. */
function CellContent({ children }: { children: ReactNode }) {
  if (typeof children === 'string' || typeof children === 'number') {
    return (
      <span className="min-w-0 flex-1 truncate text-ods-text-primary text-h4" title={String(children)}>
        {children}
      </span>
    );
  }
  return <>{children}</>;
}

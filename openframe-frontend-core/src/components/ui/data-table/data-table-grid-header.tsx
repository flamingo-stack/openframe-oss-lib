'use client';

import { flexRender, type Header } from '@tanstack/react-table';
import { cn } from '../../../utils/cn';
import { Arrow01DownIcon, Arrow01UpIcon, SwitchVrIcon } from '../../icons-v2-generated';
import { TextLineSkeleton } from '../../loading/unified-skeleton';
import { Checkbox } from '../checkbox';
import { InfoHint } from '../info-hint';
import { useLoadingScope } from '../loading-scope';
import { useDataTableContext } from './data-table';
import { DataTableColumnFilter } from './data-table-column-filter';
import {
  GRID_PIN_LEFT_VAR,
  GRID_PIN_RIGHT_VAR,
  GRID_ROW_CLASS,
  GridGradient,
  gridCellClass,
  gridCellStyle,
  useGridScroll,
  useGridScrollElements,
  type GridColumn,
  type GridLayout,
} from './data-table-grid';
import { GRID_CHECKBOX_CLASS, GRID_CHECKBOX_INDICATOR_CLASS } from './data-table-grid-columns';
import { GridResizeHandle } from './data-table-grid-resize';
import { GridSettingsHeaderCell } from './data-table-grid-settings';
import type { DataTableSortState } from './data-table-header';

type AnyHeader = Header<unknown, unknown>;

interface DataTableGridHeaderProps {
  layout: GridLayout;
  className?: string;
  stickyHeader?: boolean;
  stickyHeaderOffset?: string;
  sort: DataTableSortState | null;
  onSortChange?: (columnId: string) => void;
  /** The table is loading: the header names no column (see `DataTableHeaderProps.loading`). */
  loading?: boolean;
}

/**
 * The grid layout's header row (the design's `table/header-cell` and the header forms of `table/utility-cell`), at
 * every width.
 *
 * In page mode it is its own viewport, sticky to the page and kept at the body's horizontal position; in fixed-height
 * mode it is a sticky row inside the table's one viewport.
 */
export function DataTableGridHeader({
  layout,
  className,
  stickyHeader,
  stickyHeaderOffset,
  sort,
  onSortChange,
  loading: loadingProp,
}: DataTableGridHeaderProps) {
  const table = useDataTableContext();
  const scroll = useGridScroll();
  // The body's own switch: a page's loading scope, or the host's read.
  const inScope = useLoadingScope();
  const loading = inScope || loadingProp === true;
  const { headerViewportRef, onHeaderWheel, onHeaderScroll } = useGridScrollElements();
  const headerGroup = table.getHeaderGroups()[0];
  if (!headerGroup) return null;

  const headers = new Map<string, AnyHeader>(headerGroup.headers.map(header => [header.column.id, header]));
  const row = (
    <div className={GRID_ROW_CLASS}>
      {layout.columns.map(column => (
        <GridHeaderCell
          key={column.id}
          column={column}
          header={headers.get(column.id)}
          sort={sort}
          onSortChange={onSortChange}
          loading={loading}
        />
      ))}
    </div>
  );

  if (scroll.mode === 'fixed') {
    return (
      <div data-grid-header className={cn('sticky top-0 z-[3] w-max min-w-full', className)}>
        {row}
      </div>
    );
  }

  return (
    <div
      data-grid-header
      className={cn(
        // `peer`: the grid body after it drops its own top edge and corners (see `DataTableBody`).
        'peer/gridheader',
        // A square page-coloured backing: no row shows behind the header's round corners while it is stuck.
        stickyHeader && `sticky z-10 bg-ods-bg ${stickyHeaderOffset ?? 'top-0'}`,
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-t-md border border-b-0 border-ods-border">
        <div ref={headerViewportRef} className="overflow-hidden" onWheel={onHeaderWheel} onScroll={onHeaderScroll}>
          {row}
        </div>
        <GridGradient edge="left" offset={GRID_PIN_LEFT_VAR} />
        <GridGradient edge="right" offset={GRID_PIN_RIGHT_VAR} />
      </div>
    </div>
  );
}

interface GridHeaderCellProps {
  column: GridColumn;
  header: AnyHeader | undefined;
  sort: DataTableSortState | null;
  onSortChange?: (columnId: string) => void;
  loading: boolean;
}

/** The header label: one line, never cut (the column's minimum width is its header's width). */
const GRID_HEADER_LABEL_CLASS = 'whitespace-nowrap text-h5';

function GridHeaderCell({ column, header, sort, onSortChange, loading }: GridHeaderCellProps) {
  const table = useDataTableContext();
  const box = gridCellClass(column, 'header');
  const style = gridCellStyle(column);

  if (column.kind === 'select') {
    return (
      <div className={box} style={style}>
        <Checkbox
          aria-label="Select all rows"
          className={GRID_CHECKBOX_CLASS}
          boxClassName={GRID_CHECKBOX_CLASS}
          indicatorClassName={GRID_CHECKBOX_INDICATOR_CLASS}
          // Checked only when every loaded row is selected: the design draws no partial state.
          checked={table.getIsAllRowsSelected()}
          onCheckedChange={checked => table.toggleAllRowsSelected(checked)}
        />
      </div>
    );
  }
  if (column.settings) return <GridSettingsHeaderCell column={column} />;
  if (column.kind !== 'data' || !header || header.isPlaceholder) {
    return <div className={box} style={style} />;
  }

  // A loading table names no column: this may not be the column that ends up here (a column behind a flag still being
  // read, the viewer's saved order), so the cell is a bar in the label's place, with no control.
  if (loading) {
    return (
      <div className={box} style={style} data-grid-header-cell data-grid-header-loading>
        <span className={cn(GRID_HEADER_LABEL_CLASS, 'text-ods-text-secondary')}>
          <TextLineSkeleton type="inherit" as="span" className="w-24 max-w-full" />
        </span>
      </div>
    );
  }

  const meta = header.column.columnDef.meta;
  const filter = meta?.filter;
  const canSort = meta?.sortable === true && !filter;
  const sortDir: false | 'asc' | 'desc' = sort?.id === column.id ? (sort.desc ? 'desc' : 'asc') : false;
  const label = resolveHeaderLabel(header);
  const hint = meta?.hint ? <InfoHint label={label}>{meta.hint}</InfoHint> : null;

  return (
    <div
      // Hover changes the cell's fill and nothing else: the label stays grey until its control is applied.
      className={cn(
        box,
        'group/gridhead hover:bg-ods-card',
        !column.pin && 'relative',
        canSort && 'cursor-pointer select-none',
      )}
      style={style}
      data-grid-header-cell
      data-grid-col={column.id}
      onClick={canSort ? () => onSortChange?.(column.id) : undefined}
    >
      {filter ? (
        <>
          <DataTableColumnFilter
            variant="grid"
            column={header.column}
            options={filter.options}
            placement={filter.placement}
            pending={filter.pending}
            label={label}
            align={column.align}
          />
          {hint}
        </>
      ) : (
        <>
          <GridHeaderLabel header={header} applied={sortDir !== false} />
          {hint}
          {canSort && <SortIcon sorted={sortDir} />}
        </>
      )}
      {header.column.getCanResize() && <GridResizeHandle column={header.column} gridColumn={column} label={label} />}
    </div>
  );
}

function GridHeaderLabel({ header, applied }: { header: AnyHeader; applied: boolean }) {
  const headerDef = header.column.columnDef.header;
  const tone = applied ? 'text-ods-text-primary' : 'text-ods-text-secondary';
  // The label is read data (whose list the table is): its bar in the label's own box and type step.
  if (header.column.columnDef.meta?.headerLoading) {
    return (
      <span className={cn(GRID_HEADER_LABEL_CLASS, tone)}>
        <TextLineSkeleton type="inherit" as="span" className="w-24 max-w-full" />
      </span>
    );
  }
  if (headerDef === undefined) return null;
  if (typeof headerDef === 'string') return <span className={cn(GRID_HEADER_LABEL_CLASS, tone)}>{headerDef}</span>;
  // Render-function or node: the caller styles it.
  return <>{flexRender(headerDef, header.getContext())}</>;
}

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <Arrow01UpIcon className="h-4 w-4 shrink-0 text-ods-accent" />;
  if (sorted === 'desc') return <Arrow01DownIcon className="h-4 w-4 shrink-0 text-ods-accent" />;
  return <SwitchVrIcon className="h-4 w-4 shrink-0 text-ods-text-secondary" />;
}

function resolveHeaderLabel(header: AnyHeader): string {
  const headerDef = header.column.columnDef.header;
  return typeof headerDef === 'string' ? headerDef : header.column.id;
}

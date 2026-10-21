'use client';

import type { ReactNode } from 'react';
import Link from '../../embed-shims/next-link';
import { cn } from '../../utils/cn';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { LoadingItems, loadingItemProps, useLoadingScope } from './loading-scope';

/**
 * StackedRowsPanel — a single bordered card that stacks rows inside it.
 *
 * Each row can be:
 * - a single full-width element (e.g. title + subtitle) — pass one column,
 * - N columns (each a value + label, possibly a tag/avatar) — pass several columns,
 * - an arbitrary node (e.g. a nested table) — pass `content`.
 *
 * Border-radius behaviour is handled entirely by the container: `rounded-md` +
 * `overflow-clip` clip the first/last rows to the rounded corners. So a single row
 * rounds all four corners, while many rows visually round only the top corners of
 * the first row and the bottom corners of the last — with no per-row corner logic.
 *
 * Cells render the ODS `value` (`text-h4`) over `label` (`text-h6`) pattern with an
 * optional leading icon, matching the app's detail layouts. Pass a node as `value`
 * (e.g. a `Tag`) to render a status chip with a caption beneath it.
 */

export type PanelColumnAlign = 'left' | 'center' | 'right';
export type PanelHideAt = 'md' | 'lg' | 'xl';

export interface PanelColumn {
  /** Stable key for the column. */
  key: string;
  /** Custom cell content (tag, avatar + text, button…). Takes precedence over `value`/`label`. */
  content?: ReactNode;
  /** Primary value rendered in the ODS h4 style when `content` is not set. `null` is a value still being read: in a
   *  loading scope the cell draws it as an `h4` bar (outside one, nothing). */
  value?: ReactNode;
  /** Secondary label rendered under the value (ODS h6, secondary colour); a node for inline emphasis. `null` is a label
   *  still being read: in a loading scope the cell draws it as an `h6` bar (outside one, nothing). */
  label?: ReactNode;
  /** Let the value AND label WRAP instead of truncating to one line (full names, full sentences). */
  wrap?: boolean;
  /** Icon shown before the value. */
  icon?: ReactNode;
  /** Icon shown before the whole value/label stack, vertically centered against
   *  both lines (the info-banner pattern: 24px glyph + title + caption). */
  leadingIcon?: ReactNode;
  /** When set, the cell becomes an external link. */
  href?: string;
  /** Tailwind width class. Defaults to `flex-[1_0_0] min-w-0`. */
  width?: string;
  /** Horizontal alignment of the column content. Defaults to `left`. */
  align?: PanelColumnAlign;
  /** Hide the column below this breakpoint (mirrors the DataTable `hideAt` concept). */
  hideAt?: PanelHideAt;
}

export interface PanelRow {
  /** Stable key for the row. */
  id: string;
  /** One column → full-width row; several columns → a columns row. */
  columns?: PanelColumn[];
  /** Arbitrary content (e.g. a nested table). Takes precedence over `columns`. */
  content?: ReactNode;
  /** Per-row overrides (e.g. height, or `p-0` for a nested table that should reach the edges). */
  className?: string;
}

export interface StackedRowsPanelProps {
  rows: PanelRow[];
  /** Optional uppercase caption rendered above the card. */
  title?: string;
  className?: string;
  /** The shape drawn while the rows are read (a page's loading state, where `rows` is empty): how many rows (default
   *  3), how many value/label columns each carries (default 1, a full-width title/caption row), and whether each cell
   *  carries a label under its value (default `true`). */
  skeleton?: { rows?: number; columns?: number; labels?: boolean };
  /**
   * The rows are a read list (how many there are is the data's; the loading state draws `loadingRows` of them):
   * every row carries `data-loading-item`, in both forms. Default false (a panel of fixed fields).
   */
  listItems?: boolean;
  /** The rows are still being read (a client read): the panel draws its rows' loading form, `rows` is ignored. A
   *  loading scope does the same while `rows` is empty. */
  loading?: boolean;
  /** How many rows the loading form draws: the list's page size, limit or declared typical constant. Default
   *  `skeleton.rows`, else 3. */
  loadingRows?: number;
}

/** Rows a loading panel draws when its caller names no count. */
const STACKED_ROWS_SKELETON_COUNT = 3;

const ALIGN_CLASS: Record<PanelColumnAlign, string> = {
  left: 'justify-start items-start',
  center: 'justify-center items-center',
  right: 'justify-end items-end',
};

// Horizontal alignment for value/label cells. `left` keeps the default stretch so
// the value/label can truncate; center/right shrink to content and align the cell.
const CELL_ITEMS_ALIGN: Record<PanelColumnAlign, string> = {
  left: '',
  center: 'items-center',
  right: 'items-end',
};

const HIDE_CLASS: Record<PanelHideAt, string> = {
  md: 'hidden content-md:flex',
  lg: 'hidden content-lg:flex',
  xl: 'hidden content-xl:flex',
};

// Base column-row class. Row height is content-driven via the min-heights, matching
// the joined-row pattern used across the detail layouts (56px mobile, 80px tablet+).
const ROW_CLASS =
  'flex items-center gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] min-h-14 content-md:min-h-20 border-b border-ods-border last:border-b-0';
// A single-column row is a full-width title/subtitle row, padded symmetrically.
const FULL_WIDTH_ROW_CLASS =
  'flex items-center gap-[var(--spacing-system-m)] border-b border-ods-border p-[var(--spacing-system-m)] last:border-b-0';
const CARD_CLASS = 'flex flex-col overflow-clip rounded-md border border-ods-border bg-ods-card';
const TITLED_CLASS = 'flex flex-col gap-[var(--spacing-system-xxs)]';
const TITLE_CLASS = 'uppercase text-ods-text-secondary text-h5';
const DEFAULT_WIDTH_CLASS = 'flex-[1_0_0] min-w-0';
/** A cell's value and label while they are read: one bar each, the same in a loading row and in a loaded row whose
 *  value or label is still `null`. */
const CELL_VALUE_BAR_CLASS = 'w-1/2';
const CELL_LABEL_BAR_CLASS = 'w-3/4';

function CellValue({ column }: { column: PanelColumn }) {
  // A `null` value or label in a loading scope is read data not here yet: the cell draws its bar in the text's own
  // box (the value's `h4`, the label's `h6`), so the row keeps its loaded height.
  const loading = useLoadingScope();
  const valueBar = loading && column.value === null;
  const labelBar = loading && column.label === null;
  const valueNode = (
    <div
      className={cn(column.wrap ? 'whitespace-normal' : 'truncate', 'text-ods-text-primary text-h4')}
      title={typeof column.value === 'string' ? column.value : undefined}
    >
      {valueBar ? <TextLineSkeleton type="inherit" as="span" className={CELL_VALUE_BAR_CLASS} /> : column.value}
    </div>
  );

  return (
    <>
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
        {column.icon && <span className="shrink-0">{column.icon}</span>}
        {column.href ? (
          <Link
            href={column.href}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 transition-opacity hover:opacity-80"
          >
            {valueNode}
          </Link>
        ) : (
          valueNode
        )}
      </div>
      {labelBar ? (
        <p className="text-h6">
          <TextLineSkeleton type="inherit" as="span" className={CELL_LABEL_BAR_CLASS} />
        </p>
      ) : column.label ? (
        <p className={cn(column.wrap ? 'whitespace-normal' : 'truncate', 'text-ods-text-secondary text-h6')}>
          {column.label}
        </p>
      ) : null}
    </>
  );
}

function PanelCell({ column }: { column: PanelColumn }) {
  const widthClass = column.width ?? DEFAULT_WIDTH_CLASS;
  const hideClass = column.hideAt ? HIDE_CLASS[column.hideAt] : 'flex';

  if (column.content !== undefined) {
    return (
      <div className={cn(hideClass, 'flex-col', ALIGN_CLASS[column.align ?? 'left'], widthClass)}>{column.content}</div>
    );
  }

  if (column.leadingIcon) {
    return (
      <div className={cn(hideClass, 'items-center gap-[var(--spacing-system-s)]', widthClass)}>
        <span className="shrink-0">{column.leadingIcon}</span>
        <div className={cn('flex min-w-0 flex-1 flex-col justify-center', CELL_ITEMS_ALIGN[column.align ?? 'left'])}>
          <CellValue column={column} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(hideClass, 'flex-col justify-center', CELL_ITEMS_ALIGN[column.align ?? 'left'], widthClass)}>
      <CellValue column={column} />
    </div>
  );
}

/** The shape a row draws while it is read: how many value/label columns, and whether each cell has a label. */
interface PanelRowLoadingShape {
  columns: number;
  labels: boolean;
}

/**
 * One row of the card. ONE structure in both forms: loaded (`row`) its cells; loading (`loading`) the same row frame
 * with each cell's value a `text-h4` bar over its label's `text-h6` bar. Its `data-*` markers are forwarded in both.
 */
function PanelRowView({
  row,
  loading,
  ...props
}: {
  row?: PanelRow;
  loading?: PanelRowLoadingShape;
  [key: `data-${string}`]: unknown;
}) {
  const item = loadingItemProps(props);
  if (loading) {
    return (
      <div className={loading.columns === 1 ? FULL_WIDTH_ROW_CLASS : ROW_CLASS} {...item}>
        <LoadingItems count={loading.columns}>
          {() => (
            <div className={cn('flex flex-col justify-center', DEFAULT_WIDTH_CLASS)}>
              <TextLineSkeleton type="h4" className={CELL_VALUE_BAR_CLASS} />
              {loading.labels && <TextLineSkeleton type="h6" className={CELL_LABEL_BAR_CLASS} />}
            </div>
          )}
        </LoadingItems>
      </div>
    );
  }
  if (!row) return null;
  // Arbitrary content (e.g. a nested table): keep it edge-to-edge unless the caller
  // overrides via `className`. No fixed height — let the content size itself.
  if (row.content !== undefined) {
    return (
      <div className={cn('border-b border-ods-border last:border-b-0', row.className)} {...item}>
        {row.content}
      </div>
    );
  }

  const columns = row.columns ?? [];
  const isFullWidth = columns.length === 1;

  // A single-column row is a full-width title/subtitle row: pad symmetrically
  // (ODS `m`) instead of using a fixed column-row height.
  const rowClass = isFullWidth ? cn(FULL_WIDTH_ROW_CLASS, row.className) : cn(ROW_CLASS, row.className);

  return (
    <div className={rowClass} {...item}>
      {columns.map(column => (
        <PanelCell key={column.key} column={column} />
      ))}
    </div>
  );
}

/** The panel's frame, loaded and loading: the optional uppercase title (static copy) over the card. */
function PanelFrame({ title, className, card }: { title?: string; className?: string; card: ReactNode }) {
  if (!title) return <div className={className}>{card}</div>;
  return (
    <div className={cn(TITLED_CLASS, className)}>
      <p className={TITLE_CLASS}>{title}</p>
      {card}
    </div>
  );
}

export function StackedRowsPanel({
  rows,
  title,
  className,
  skeleton,
  listItems = false,
  loading: loadingProp = false,
  loadingRows,
}: StackedRowsPanelProps) {
  // ONE switch: while the host reads the rows (`loading`), or in a page's loading state with no rows yet, the panel
  // draws its rows' loading form in the same frame; rows it is given in a scope are the page's own copy and draw as
  // they are.
  const inScope = useLoadingScope();
  const loading = loadingProp || (inScope && rows.length === 0);
  const marker = { 'data-loading-item': listItems || undefined };
  const shape: PanelRowLoadingShape = { columns: skeleton?.columns ?? 1, labels: skeleton?.labels ?? true };
  const card = loading ? (
    <div className={CARD_CLASS} aria-hidden>
      <LoadingItems count={loadingRows ?? skeleton?.rows ?? STACKED_ROWS_SKELETON_COUNT}>
        {() => <PanelRowView loading={shape} {...marker} />}
      </LoadingItems>
    </div>
  ) : (
    <div className={CARD_CLASS}>
      {rows.map(row => (
        <PanelRowView key={row.id} row={row} {...marker} />
      ))}
    </div>
  );
  return <PanelFrame title={title} className={className} card={card} />;
}

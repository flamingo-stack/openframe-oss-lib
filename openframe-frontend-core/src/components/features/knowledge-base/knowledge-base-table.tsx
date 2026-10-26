'use client';

import { type ReactNode, useMemo } from 'react';
import { formatDate, formatTime } from '../../../utils/format-date';
import { openInNewTab } from '../../../utils/open-in-new-tab';
import { ArrowRightUpIcon } from '../../icons-v2-generated';
import { TextLineSkeleton } from '../../loading/unified-skeleton';
import { Button } from '../../ui/button/button';
import { type ColumnDef, DataTable, dataTableLoadingRows, type Row, useDataTable } from '../../ui/data-table';
import { DATA_TABLE_SKELETON_ROWS } from '../../ui/data-table/utils';
import { useLoadingScope } from '../../ui/loading-scope';
import { Tag as StatusTag } from '../../ui/tag';
import { TruncateText } from '../../ui/truncate-text';
import { KNOWLEDGE_BASE_ITEM_ICON } from './knowledge-base-item-icon';
import { KNOWLEDGE_BASE_STATUS_VARIANT, type KnowledgeBaseArticleStatus } from './knowledge-base-status';

export type KnowledgeBaseRowType = 'ARTICLE' | 'FOLDER' | string;
export type KnowledgeBaseRowStatus = KnowledgeBaseArticleStatus | string | null | undefined;

export interface KnowledgeBaseRow {
  readonly id: string;
  readonly type: KnowledgeBaseRowType;
  readonly name: string;
  readonly parentId?: string | null;
  readonly status?: KnowledgeBaseRowStatus;
  readonly summary?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
  readonly tags?: ReadonlyArray<{ readonly id: string; readonly key: string; readonly color?: string | null }>;
}

export type KnowledgeBaseTableMode = 'standard' | 'archive';

/** A row still being read: an article, every field a cell shows empty (each cell draws its loading form). */
const loadingItem = (id: string): KnowledgeBaseRow => ({ id, type: 'ARTICLE', name: '' });

/** The "open in new tab" button: static chrome, drawn real and inert while the row is read. */
function KnowledgeBaseOpenButton({ href }: { href: string }) {
  const loading = useLoadingScope();
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <Button
        onClick={loading ? undefined : openInNewTab(href)}
        disabled={loading}
        variant="outline"
        size="icon"
        leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
        aria-label="Open in new tab"
        className="bg-ods-card"
      />
    </div>
  );
}

/** The Name cell: the item's icon, its name and status, and an article's summary; bars while the row is read. */
function KnowledgeBaseNameCell({ item }: { item: KnowledgeBaseRow }) {
  const loading = useLoadingScope();
  const Icon = item.type === 'FOLDER' ? KNOWLEDGE_BASE_ITEM_ICON.FOLDER : KNOWLEDGE_BASE_ITEM_ICON.ARTICLE;
  const status = item.status as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | null | undefined;
  const tagStatus = status === 'DRAFT' || status === 'ARCHIVED' ? status : null;
  return (
    <div className="relative box-border flex h-20 w-full shrink-0 content-stretch items-center justify-start gap-[var(--spacing-system-m)] py-0">
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-ods-border">
        <Icon size={16} className="shrink-0 text-ods-text-secondary" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-center gap-[var(--spacing-system-xsf)]">
          {/* min-w-0 wrapper so the FloatingTooltip trigger div can shrink and the name ellipsizes. */}
          <div className="min-w-0">
            <TruncateText>{item.name}</TruncateText>
          </div>
          {tagStatus && (
            <StatusTag variant={KNOWLEDGE_BASE_STATUS_VARIANT[tagStatus]} label={tagStatus} className="shrink-0" />
          )}
        </div>
        {item.type === 'ARTICLE' && (item.summary || loading) && (
          <TruncateText variant="h6" tone="secondary">
            {item.summary ?? ''}
          </TruncateText>
        )}
      </div>
    </div>
  );
}

/** The date cell: an article's date over its time; two bars while the row is read. */
function KnowledgeBaseDateCell({ item, mode }: { item: KnowledgeBaseRow; mode: KnowledgeBaseTableMode }) {
  if (useLoadingScope()) {
    return (
      <div className="flex flex-col whitespace-nowrap">
        <TextLineSkeleton type="h4" className="w-24" />
        <TextLineSkeleton type="h5" className="w-16" />
      </div>
    );
  }
  if (item.type !== 'ARTICLE') return null;
  const ts = mode === 'archive' ? (item.updatedAt ?? item.createdAt) : item.createdAt;
  if (!ts) return null;
  return (
    <div className="flex flex-col whitespace-nowrap">
      <span className="text-ods-text-primary text-h4">{formatDate(ts)}</span>
      <span className="text-heading-5 text-ods-text-secondary">{formatTime(ts)}</span>
    </div>
  );
}

/** Where a row leads: the article's page, or the folder's listing. */
export type KnowledgeBaseRowHref = (item: KnowledgeBaseRow) => string;

/**
 * Click handler that opens `href` in a new tab. The button sits inside a row
 * that renders as a link, and `<a>` cannot be nested inside `<a>`, so it is a
 * `<button>` that opens the tab itself.
 */
/** The trailing "open in new tab" column. */
export function getKnowledgeBaseOpenColumn(getHref: KnowledgeBaseRowHref): ColumnDef<KnowledgeBaseRow> {
  return {
    id: 'open',
    cell: ({ row }: { row: Row<KnowledgeBaseRow> }) => <KnowledgeBaseOpenButton href={getHref(row.original)} />,
    enableSorting: false,
    meta: { width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
  };
}

export function getKnowledgeBaseColumns(mode: KnowledgeBaseTableMode): ColumnDef<KnowledgeBaseRow>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }: { row: Row<KnowledgeBaseRow> }) => <KnowledgeBaseNameCell item={row.original} />,
      enableSorting: false,
      meta: { width: 'flex-1 min-w-0' },
    },
    {
      accessorKey: mode === 'archive' ? 'updatedAt' : 'createdAt',
      header: mode === 'archive' ? 'Archived' : 'Created',
      cell: ({ row }: { row: Row<KnowledgeBaseRow> }) => <KnowledgeBaseDateCell item={row.original} mode={mode} />,
      enableSorting: false,
      meta: { width: 'w-[140px]', hideAt: 'lg' },
    },
  ];
}

export interface KnowledgeBaseTableBodyProps {
  items: KnowledgeBaseRow[];
  /**
   * Where a row leads, for the row link and the "open in new tab" button.
   * Pass a stable function (module level or `useCallback`): the columns and
   * the rows are memoized on it.
   */
  getHref: KnowledgeBaseRowHref;
  mode?: KnowledgeBaseTableMode;
  isLoading?: boolean;
  emptyMessage?: string;
  skeletonRows?: number;
  stickyHeaderOffset?: string;
  footerSlot?: ReactNode;
  actionsColumn?: ColumnDef<KnowledgeBaseRow>;
  // Server-side total. Without it, RowCount shows only currently-loaded rows.
  totalCount?: number;
  /** The narrow rendering: the name column and the row actions only (no date, no "open in new tab"). */
  compact?: boolean;
}

export function KnowledgeBaseTableBody({
  items,
  getHref,
  mode = 'standard',
  isLoading,
  emptyMessage = 'No items found.',
  skeletonRows,
  stickyHeaderOffset,
  footerSlot,
  actionsColumn,
  totalCount,
  compact = false,
}: KnowledgeBaseTableBodyProps) {
  const columns = useMemo<ColumnDef<KnowledgeBaseRow>[]>(() => {
    const base = getKnowledgeBaseColumns(mode);
    const leading = compact ? base.slice(0, 1) : base;
    const trailing = compact ? [] : [getKnowledgeBaseOpenColumn(getHref)];
    return actionsColumn ? [...leading, actionsColumn, ...trailing] : [...leading, ...trailing];
  }, [mode, actionsColumn, getHref, compact]);

  // While loading the table holds one page of placeholder rows, drawn with the real cells (`loadingCells`).
  const loading = useLoadingScope() || !!isLoading;
  const loadingRows = useMemo(
    () => (loading ? dataTableLoadingRows(skeletonRows ?? DATA_TABLE_SKELETON_ROWS, loadingItem) : null),
    [loading, skeletonRows],
  );
  const table = useDataTable<KnowledgeBaseRow>({
    data: loadingRows ?? items,
    columns,
    getRowId: row => row.id,
    enableSorting: false,
  });

  return (
    <DataTable table={table}>
      <DataTable.Header
        stickyHeader={!!stickyHeaderOffset}
        stickyHeaderOffset={stickyHeaderOffset}
        rightSlot={
          <DataTable.RowCount
            itemName={mode === 'archive' ? 'article' : 'item'}
            totalCount={totalCount}
            loading={loading}
          />
        }
      />
      <DataTable.Body
        loading={loading}
        loadingCells
        skeletonRows={skeletonRows}
        emptyMessage={emptyMessage}
        rowHref={getHref}
      />
      {footerSlot}
    </DataTable>
  );
}

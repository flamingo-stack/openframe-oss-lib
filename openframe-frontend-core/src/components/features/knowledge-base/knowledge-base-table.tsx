'use client';

import { type ReactNode, useMemo } from 'react';
import { formatDate, formatTime } from '../../../utils/format-date';
import { openInNewTab } from '../../../utils/open-in-new-tab';
import { ArrowRightUpIcon } from '../../icons-v2-generated';
import { Button } from '../../ui/button/button';
import { type ColumnDef, DataTable, type Row, useDataTable } from '../../ui/data-table';
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
    cell: ({ row }: { row: Row<KnowledgeBaseRow> }) => (
      <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
        <Button
          onClick={openInNewTab(getHref(row.original))}
          variant="outline"
          size="icon"
          leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
          aria-label="Open in new tab"
          className="bg-ods-card"
        />
      </div>
    ),
    enableSorting: false,
    meta: { width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
  };
}

export function getKnowledgeBaseColumns(mode: KnowledgeBaseTableMode): ColumnDef<KnowledgeBaseRow>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }: { row: Row<KnowledgeBaseRow> }) => {
        const item = row.original;
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
                  <StatusTag
                    variant={KNOWLEDGE_BASE_STATUS_VARIANT[tagStatus]}
                    label={tagStatus}
                    className="shrink-0"
                  />
                )}
              </div>
              {item.type === 'ARTICLE' && item.summary && (
                <TruncateText variant="h6" tone="secondary">
                  {item.summary}
                </TruncateText>
              )}
            </div>
          </div>
        );
      },
      enableSorting: false,
      meta: { width: 'flex-1 min-w-0' },
    },
    {
      accessorKey: mode === 'archive' ? 'updatedAt' : 'createdAt',
      header: mode === 'archive' ? 'Archived' : 'Created',
      cell: ({ row }: { row: Row<KnowledgeBaseRow> }) => {
        if (row.original.type !== 'ARTICLE') return null;
        const ts = mode === 'archive' ? (row.original.updatedAt ?? row.original.createdAt) : row.original.createdAt;
        if (!ts) return null;
        return (
          <div className="flex flex-col whitespace-nowrap">
            <span className="text-ods-text-primary text-h4">{formatDate(ts)}</span>
            <span className="text-heading-5 text-ods-text-secondary">{formatTime(ts)}</span>
          </div>
        );
      },
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

  const table = useDataTable<KnowledgeBaseRow>({
    data: items,
    columns,
    getRowId: row => row.id,
    enableSorting: false,
  });

  return (
    <DataTable table={table}>
      <DataTable.Header
        stickyHeader={!!stickyHeaderOffset}
        stickyHeaderOffset={stickyHeaderOffset}
        rightSlot={<DataTable.RowCount itemName={mode === 'archive' ? 'article' : 'item'} totalCount={totalCount} />}
      />
      <DataTable.Body loading={isLoading} skeletonRows={skeletonRows} emptyMessage={emptyMessage} rowHref={getHref} />
      {footerSlot}
    </DataTable>
  );
}

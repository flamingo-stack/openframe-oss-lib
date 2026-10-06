'use client';

import { type MouseEvent, type ReactNode, useCallback, useMemo, useState } from 'react';
import { ArrowRightUpIcon } from '../../icons-v2-generated/arrows/arrow-right-up-icon';
import { Button } from '../../ui/button';
import { type ColumnDef, DataTable, type Row, type SortingState, useDataTable } from '../../ui/data-table';
import { MoreActionsMenu } from '../../ui/more-actions-menu';
import type { NoDataProps } from '../../ui/no-data';
import { Tag } from '../../ui/tag';
import { TruncateText } from '../../ui/truncate-text';
import { OSTypeBadgeGroup } from '../os-type-badge-group';
import type { PolicyTableRow } from './policy-table-row';

/**
 * Click handler that opens `href` in a new tab. The row is itself a link and
 * an `<a>` cannot be nested in an `<a>`, so the button opens it by script.
 */
function openInNewTab(href: string) {
  return (event: MouseEvent) => {
    event.preventDefault();
    window.open(href, '_blank', 'noopener,noreferrer');
  };
}

const EMPTY_COLUMN_FILTERS: never[] = [];

// An empty platform list means the policy applies to every OS, so we render the
// full set of OS icons rather than a plain-text "All" label.
const ALL_PLATFORMS = ['windows', 'darwin', 'linux'];

const NOTE_TONE_CLASS = {
  error: 'text-ods-error',
  warning: 'text-ods-warning',
} as const;

export interface PoliciesTableProps {
  rows: PolicyTableRow[];
  isLoading?: boolean;
  /** Show the OS Platform column (fleet-wide monitoring view). */
  showPlatform?: boolean;
  /** Enable client-side sorting on Severity & Status, with header sort controls. */
  sortable?: boolean;
  emptyMessage?: string;
  /** Rich empty state (icon + title + description), overrides `emptyMessage`. */
  emptyState?: NoDataProps;
  /** Make each row a link to its `href`. */
  rowAsLink?: boolean;
  stickyHeader?: boolean;
  stickyHeaderOffset?: string;
  /** Rendered at the right edge of the header (e.g. a row count). */
  rightSlot?: ReactNode;
  skeletonRows?: number;
  /** Infinite "load more" footer. */
  hasMore?: boolean;
  onLoadMore?: () => void;
}

/**
 * Shared policies table. Renders a normalized `PolicyTableRow[]` with a
 * consistent column set (Policy name+description, Severity, optional Platform,
 * Status, optional row actions, open-in-new-tab). Used by both the fleet-wide
 * monitoring page and the per-device Policies tab.
 */
export function PoliciesTable({
  rows,
  isLoading = false,
  showPlatform = false,
  sortable = false,
  emptyMessage,
  emptyState,
  rowAsLink = false,
  stickyHeader = false,
  stickyHeaderOffset,
  rightSlot,
  skeletonRows = 10,
  hasMore = false,
  onLoadMore,
}: PoliciesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  // Reserve the actions column while loading so the column count stays stable across
  // skeleton, loading and loaded (otherwise it appears once rows arrive and shifts every
  // column, the "jitter"). Loaded rows in every caller carry actions.
  const hasActions = useMemo(() => isLoading || rows.some(r => r.actions && r.actions.length > 0), [isLoading, rows]);

  const columns = useMemo<ColumnDef<PolicyTableRow>[]>(() => {
    const cols: ColumnDef<PolicyTableRow>[] = [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }: { row: Row<PolicyTableRow> }) => (
          <div className="flex min-h-[60px] min-w-0 flex-col justify-center gap-1 py-2">
            <TruncateText>{row.original.name}</TruncateText>
            {row.original.description && (
              <TruncateText variant="h6" tone="secondary">
                {row.original.description}
              </TruncateText>
            )}
          </div>
        ),
        meta: { width: 'flex-1 min-w-0' },
      },
      {
        id: 'severity',
        accessorFn: (row: PolicyTableRow) => (row.critical ? 1 : 0),
        header: 'SEVERITY',
        cell: ({ row }: { row: Row<PolicyTableRow> }) => (
          <span className="text-ods-text-primary text-h6">{row.original.severityLabel}</span>
        ),
        enableSorting: sortable,
        meta: { width: 'w-[100px]', sortable, hideAt: 'md' },
      },
    ];

    if (showPlatform) {
      cols.push({
        id: 'platform',
        header: 'PLATFORM',
        cell: ({ row }: { row: Row<PolicyTableRow> }) => {
          const platforms = row.original.platforms ?? [];
          const osTypes = platforms.length > 0 ? platforms : ALL_PLATFORMS;
          return <OSTypeBadgeGroup osTypes={osTypes} iconSize="w-6 h-6" />;
        },
        meta: { width: 'w-[140px]', hideAt: 'lg' },
      });
    }

    cols.push({
      id: 'status',
      accessorFn: (row: PolicyTableRow) => row.status.label,
      header: 'STATUS',
      cell: ({ row }: { row: Row<PolicyTableRow> }) => {
        const { status } = row.original;
        return (
          <div className="flex flex-col items-start gap-1">
            <Tag className="self-start" label={status.label} variant={status.variant} />
            {status.note && <span className={`text-h6 ${NOTE_TONE_CLASS[status.note.tone]}`}>{status.note.text}</span>}
          </div>
        );
      },
      enableSorting: sortable,
      meta: { width: 'w-[140px]', sortable, hideAt: 'md' },
    });

    if (hasActions) {
      cols.push({
        id: 'actions',
        header: '',
        cell: ({ row }: { row: Row<PolicyTableRow> }) =>
          row.original.actions && row.original.actions.length > 0 ? (
            <div data-no-row-click className="pointer-events-auto flex items-center justify-end gap-2">
              <MoreActionsMenu items={row.original.actions} />
            </div>
          ) : null,
        enableSorting: false,
        meta: { width: 'w-12 content-md:w-auto content-md:min-w-[100px] shrink-0 flex-none', align: 'right' },
      });
    }

    cols.push({
      id: 'open',
      header: '',
      cell: ({ row }: { row: Row<PolicyTableRow> }) =>
        row.original.href ? (
          <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
            <Button
              onClick={openInNewTab(row.original.href)}
              variant="outline"
              size="icon"
              leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
              aria-label={`Open ${row.original.name}`}
              className="bg-ods-card"
            />
          </div>
        ) : null,
      enableSorting: false,
      meta: { width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
    });

    return cols;
  }, [showPlatform, sortable, hasActions]);

  const table = useDataTable<PolicyTableRow>({
    data: rows,
    columns,
    getRowId: (row: PolicyTableRow) => row.id,
    clientSideSorting: sortable,
    enableSorting: sortable,
    state: { sorting, columnFilters: EMPTY_COLUMN_FILTERS },
    onSortingChange: setSorting,
  });

  const sortState = sortable && sorting[0] ? { id: sorting[0].id, desc: sorting[0].desc } : null;
  const handleSortChange = useCallback((columnId: string) => {
    setSorting(prev => {
      const current = prev[0];
      if (!current || current.id !== columnId) return [{ id: columnId, desc: false }];
      if (!current.desc) return [{ id: columnId, desc: true }];
      return [];
    });
  }, []);

  const rowHref = useCallback((row: PolicyTableRow) => (rowAsLink ? row.href : undefined), [rowAsLink]);

  // Hide the column header on the empty state: only show it while loading (skeleton rows)
  // or when there are real rows.
  const showHeader = isLoading || rows.length > 0;

  return (
    <DataTable table={table}>
      {showHeader && (
        <DataTable.Header
          stickyHeader={stickyHeader}
          stickyHeaderOffset={stickyHeaderOffset}
          rightSlot={rightSlot}
          sort={sortState}
          onSortChange={sortable ? handleSortChange : undefined}
        />
      )}
      <DataTable.Body
        loading={isLoading}
        skeletonRows={skeletonRows}
        emptyMessage={emptyMessage}
        emptyState={emptyState}
        rowClassName="mb-1"
        rowHref={rowHref}
      />
      {hasMore && onLoadMore && (
        <DataTable.InfiniteFooter hasNextPage isFetchingNextPage={false} onLoadMore={onLoadMore} skeletonRows={2} />
      )}
    </DataTable>
  );
}

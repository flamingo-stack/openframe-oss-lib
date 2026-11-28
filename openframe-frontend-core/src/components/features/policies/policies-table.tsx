'use client';

import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { cn } from '../../../utils/cn';
import { openInNewTab } from '../../../utils/open-in-new-tab';
import { ArrowRightUpIcon } from '../../icons-v2-generated/arrows/arrow-right-up-icon';
import { Ellipsis01Icon } from '../../icons-v2-generated/interface/ellipsis-01-icon';
import { TextLineSkeleton } from '../../loading/unified-skeleton';
import { Button } from '../../ui/button';
import {
  type ColumnDef,
  DataTable,
  dataTableLoadingRows,
  GRID_ACTION_COLUMN_SIZE,
  type Row,
  type SortingState,
  type TableMetaRow,
  tableMetaRowLayout,
  useDataTable,
} from '../../ui/data-table';
import { DATA_TABLE_SKELETON_ROWS } from '../../ui/data-table/utils';
import { useLoadingScope } from '../../ui/loading-scope';
import { MoreActionsMenu } from '../../ui/more-actions-menu';
import type { NoDataProps } from '../../ui/no-data';
import { Tag } from '../../ui/tag';
import { TruncateText } from '../../ui/truncate-text';
import { GRID_ACTION_BUTTON_CLASS, GridTextWithDetailCell } from '../feature-table-grid-cells';
import { dataTableLayoutProps, type FeatureTableLayoutProps, hasSlotContent } from '../feature-table-layout';
import { OSTypeBadgeGroup } from '../os-type-badge-group';
import type { PolicyTableRow } from './policy-table-row';

/**
 * Click handler that opens `href` in a new tab. The row is itself a link and
 * an `<a>` cannot be nested in an `<a>`, so the button opens it by script.
 */
const EMPTY_COLUMN_FILTERS: never[] = [];

// An empty platform list means the policy applies to every OS, so we render the
// full set of OS icons rather than a plain-text "All" label.
const ALL_PLATFORMS = ['windows', 'darwin', 'linux'];

/** The platforms a policy applies to: its own, or every OS when it names none. */
function policyPlatforms(row: PolicyTableRow): string[] {
  const platforms = row.platforms ?? [];
  return platforms.length > 0 ? platforms : ALL_PLATFORMS;
}

/** A policy still being read: a row the table keys, every field a cell shows empty (each draws its loading form). */
const loadingPolicy = (id: string): PolicyTableRow => ({
  id,
  name: '',
  critical: false,
  severityLabel: '',
  status: { label: '', variant: 'grey' },
  href: '',
});

const NOTE_TONE_CLASS = {
  error: 'text-ods-error',
  warning: 'text-ods-warning',
} as const;

/** The Severity cell; a bar while the row is read. */
function PolicySeverity({ label }: { label: string }) {
  if (useLoadingScope() && !label) return <TextLineSkeleton type="h6" className="w-16" />;
  return <span className="text-ods-text-primary text-h6">{label}</span>;
}

/** The row's open button: static chrome, drawn real and inert while the row is read. */
function OpenPolicyButton({ href, name, grid = false }: { href: string; name: string; grid?: boolean }) {
  const loading = useLoadingScope();
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <Button
        onClick={loading ? undefined : openInNewTab(href)}
        disabled={loading}
        // In the grid the action is a bare 40px icon button: the cell is its frame.
        variant={grid ? 'transparent' : 'outline'}
        size="icon"
        leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
        aria-label={`Open ${name}`}
        className={grid ? GRID_ACTION_BUTTON_CLASS : 'bg-ods-card'}
      />
    </div>
  );
}

/** The row's menu in the grid: the same items behind a bare 40px button. Nothing for a row with no action. */
function PolicyActionsGridCell({ row }: { row: PolicyTableRow }) {
  if (!row.actions || row.actions.length === 0) return null;
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <MoreActionsMenu
        items={row.actions}
        trigger={
          <Button
            variant="transparent"
            size="icon"
            leftIcon={<Ellipsis01Icon className="h-5 w-5" />}
            aria-label="More actions"
            className={GRID_ACTION_BUTTON_CLASS}
          />
        }
      />
    </div>
  );
}

/** The grid's STATUS cell: the tag, then its note on the same line (the one part cut when the column is narrow). */
function PolicyStatusGridCell({ status }: { status: PolicyTableRow['status'] }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xxs)]">
      <span className="flex shrink-0">
        <Tag label={status.label} variant={status.variant} />
      </span>
      {status.note && (
        <span className={cn('min-w-0 flex-1 truncate text-h6', NOTE_TONE_CLASS[status.note.tone])}>
          {status.note.text}
        </span>
      )}
    </div>
  );
}

export interface PoliciesTableProps extends FeatureTableLayoutProps {
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
  /**
   * The controls at the right end of the row above the table: the auto-refresh picker. With them the row is drawn in
   * the card layout too, and `rightSlot` moves into it, on its left.
   */
  actions?: ReactNode;
  /**
   * A paged host's row above the table (`useCursorPager` `footerProps`, or the same shape from a list paged in the
   * browser): the page's range with First · Previous · Next in place of `rightSlot`'s count, and its controls (falling
   * back to `actions`). `pager: null` while the first page is read. A paged table draws no "load more" footer.
   */
  metaRow?: TableMetaRow;
  skeletonRows?: number;
  /** Infinite "load more" footer. */
  hasMore?: boolean;
  onLoadMore?: () => void;
  /** The next page is being fetched: the footer shows it and asks for nothing more meanwhile. Default false (a host that pages rows it already holds). */
  isLoadingMore?: boolean;
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
  actions,
  metaRow: metaRowGiven,
  skeletonRows,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
  layout = 'cards',
  tableMaxHeight,
  tableSettings,
}: PoliciesTableProps) {
  // ONE switch: the host's read (`isLoading`) or a page's loading scope draws the header, the reserved columns and
  // the body's skeleton rows alike.
  const loading = useLoadingScope() || isLoading;
  const [sorting, setSorting] = useState<SortingState>([]);

  // Reserve the actions column while loading so the column count stays stable across
  // skeleton, loading and loaded (otherwise it appears once rows arrive and shifts every
  // column, the "jitter"). Loaded rows in every caller carry actions.
  const hasActions = useMemo(() => loading || rows.some(r => r.actions && r.actions.length > 0), [loading, rows]);

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
        size: 480,
        meta: {
          label: 'Name',
          width: 'flex-1 min-w-0',
          gridCell: ({ row }) => <GridTextWithDetailCell text={row.original.name} detail={row.original.description} />,
        },
      },
      {
        id: 'severity',
        accessorFn: (row: PolicyTableRow) => (row.critical ? 1 : 0),
        header: 'SEVERITY',
        cell: ({ row }: { row: Row<PolicyTableRow> }) => <PolicySeverity label={row.original.severityLabel} />,
        enableSorting: sortable,
        size: 140,
        meta: {
          label: 'Severity',
          width: 'w-[100px]',
          sortable,
          hideAt: 'md',
          gridCell: ({ row }) => <DataTable.Cell text={row.original.severityLabel} />,
        },
      },
    ];

    if (showPlatform) {
      cols.push({
        id: 'platform',
        header: 'PLATFORM',
        cell: ({ row }: { row: Row<PolicyTableRow> }) => (
          <OSTypeBadgeGroup osTypes={policyPlatforms(row.original)} iconSize="w-6 h-6" />
        ),
        size: 160,
        meta: {
          label: 'Platform',
          width: 'w-[140px]',
          hideAt: 'lg',
          gridCell: ({ row }) => (
            <OSTypeBadgeGroup osTypes={policyPlatforms(row.original)} iconSize="w-5 h-5" className="flex-nowrap" />
          ),
        },
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
      size: 240,
      meta: {
        label: 'Status',
        width: 'w-[140px]',
        sortable,
        hideAt: 'md',
        gridCell: ({ row }) => <PolicyStatusGridCell status={row.original.status} />,
      },
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
        size: GRID_ACTION_COLUMN_SIZE,
        meta: {
          width: 'w-12 content-md:w-auto content-md:min-w-[100px] shrink-0 flex-none',
          align: 'right',
          gridKind: 'action',
          gridCell: ({ row }) => <PolicyActionsGridCell row={row.original} />,
        },
      });
    }

    cols.push({
      id: 'open',
      header: '',
      cell: ({ row }: { row: Row<PolicyTableRow> }) =>
        row.original.href !== undefined ? <OpenPolicyButton href={row.original.href} name={row.original.name} /> : null,
      enableSorting: false,
      size: GRID_ACTION_COLUMN_SIZE,
      // Kept by hand, not `actionColumn()`: the cards table hides the button below `md`.
      meta: {
        width: 'w-12 shrink-0 flex-none',
        hideAt: 'md',
        align: 'right',
        gridKind: 'action',
        gridCell: ({ row }) =>
          row.original.href !== undefined ? (
            <OpenPolicyButton href={row.original.href} name={row.original.name} grid />
          ) : null,
      },
    });

    return cols;
  }, [showPlatform, sortable, hasActions]);

  // While loading the table holds one page of placeholder rows, drawn with the real cells (`loadingCells`).
  const loadingRows = useMemo(
    () => (loading ? dataTableLoadingRows(skeletonRows ?? DATA_TABLE_SKELETON_ROWS, loadingPolicy) : null),
    [loading, skeletonRows],
  );
  const table = useDataTable<PolicyTableRow>({
    data: loadingRows ?? rows,
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
  const showHeader = loading || rows.length > 0;
  // A paged host's row: its controls, or the table's own `actions` when it brings none.
  const pagedRow = metaRowGiven && { ...metaRowGiven, actions: metaRowGiven.actions ?? actions };
  const pagedLayout = tableMetaRowLayout(pagedRow, {
    rowCount: rows.length,
    loading,
    showHeader,
    grid: layout === 'grid',
  });
  // The row above the table: the grid's results row, the host's controls (with the count beside them), or a paged
  // list's range and pager.
  const metaRow = pagedRow
    ? pagedLayout.drawn
    : showHeader && ((layout === 'grid' && hasSlotContent(rightSlot)) || hasSlotContent(actions));
  const paged = !!pagedRow && pagedLayout.paged;

  return (
    <DataTable table={table} {...dataTableLayoutProps({ layout, tableMaxHeight, tableSettings })}>
      {/* The grid's results row, or the host's controls, sit above the table; otherwise the card header carries the
          results in its right slot. */}
      {metaRow &&
        (pagedRow ? (
          <DataTable.MetaRow metaRow={pagedRow} paged={paged} count={rightSlot} loading={loading} />
        ) : (
          <DataTable.Meta actions={actions}>{rightSlot}</DataTable.Meta>
        ))}
      {showHeader && (
        <DataTable.Header
          stickyHeader={stickyHeader}
          stickyHeaderOffset={stickyHeaderOffset}
          rightSlot={metaRow ? undefined : rightSlot}
          sort={sortState}
          onSortChange={sortable ? handleSortChange : undefined}
          loading={loading}
        />
      )}
      <DataTable.Body
        loading={loading}
        loadingCells
        skeletonRows={skeletonRows}
        emptyMessage={emptyMessage}
        emptyState={emptyState}
        rowClassName="mb-1"
        rowHref={rowHref}
      />
      {!paged && hasMore && onLoadMore && (
        <DataTable.InfiniteFooter hasNextPage isFetchingNextPage={isLoadingMore} onLoadMore={onLoadMore} />
      )}
    </DataTable>
  );
}

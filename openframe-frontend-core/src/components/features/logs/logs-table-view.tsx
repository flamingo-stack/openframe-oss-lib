'use client';

import { type MouseEvent, type ReactNode, useCallback, useEffect, useMemo } from 'react';
import { normalizeToolTypeWithFallback, toToolLabel } from '../../../utils/tool-utils';
import {
  ArrowRightUpIcon,
  ClipboardListIcon,
  EyeAltIcon,
  EyeIcon,
  Filter01ListIcon,
  SearchIcon,
} from '../../icons-v2-generated';
import { ToolBadge } from '../../platform/ToolBadge';
import { Button } from '../../ui/button';
import { type ColumnDef, DataTable, multiSelectFilterFn, type Row, useDataTable } from '../../ui/data-table';
import { FilterModal } from '../../ui/filter-modal';
import { NoData, type NoDataProps } from '../../ui/no-data';
import { Tag } from '../../ui/tag';
import { TruncateText } from '../../ui/truncate-text';
import { logSourceLabels } from './log-source-labels';
import { LOG_COLUMN_WIDTHS } from './logs-table-columns';
import type { LogsTableColumnId, LogsTableDateFilter, LogsTableFacets, UiLogEntry } from './types';

/**
 * TanStack's column-filter state as `useDataTable` hands it back.
 */
type ColumnFilterState = { id: string; value: unknown }[];

/**
 * The lib's multi-select `filterFn` for a typed `ColumnDef<T>[]`: it is typed
 * for `unknown` rows and only ever reads the cell value, so the row type is free.
 */
function multiSelectFor<T>(): ColumnDef<T>['filterFn'] {
  return multiSelectFilterFn as unknown as ColumnDef<T>['filterFn'];
}

/** The footer button of the onboarding empty state (a guide link, when the host has one). */
export type LogsTableGuideButton = Pick<NoDataProps, 'buttonLabel' | 'buttonIcon' | 'buttonProps' | 'onButtonClick'>;

const EMPTY_TITLE = 'No logs yet';
const EMPTY_DESCRIPTION =
  'A timeline of every action taken across the platform (scripts run, policies applied, devices connected, tickets updated) will be displayed here.';

/**
 * Click handler that opens `href` in a new tab. The row is a link, and a link
 * cannot hold another link, so the button opens the tab itself.
 */
function openInNewTab(href: string) {
  return (event: MouseEvent) => {
    event.preventDefault();
    window.open(href, '_blank', 'noopener,noreferrer');
  };
}

export interface LogsTableViewProps<T extends UiLogEntry = UiLogEntry> {
  /** The rows loaded so far. Keep the array stable between renders. */
  logs: T[];
  /** A new first page is in flight: the body shows skeleton rows. */
  loading?: boolean;
  /** What the columns can be filtered by; null while unknown. */
  facets?: LogsTableFacets | null;
  /** Applied filters by column id: `status`, `tool`, `source`. */
  filters: Record<string, string[]>;
  onFilterChange: (filters: Record<string, string[]>) => void;
  /** The applied search text, which counts as a query for the empty states. */
  search?: string;
  /** The applied date filter: its range counts as a query, and the mobile filter modal edits it. */
  dateFilter?: LogsTableDateFilter;
  /** Header of the Log ID column (the host's date sort and range control). Default: the label. */
  logIdHeader?: ReactNode;
  /** The table shows one device's logs (a device tab). */
  deviceScoped?: boolean;
  /** The table is locked to one organization: the Source column has no filter. */
  organizationLocked?: boolean;
  /** Where a row leads; also what the "Open in new tab" button opens. */
  getLogHref?: (log: T) => string;
  /** The row's copy action (the host fetches the full log). */
  renderCopyAction?: (log: T) => ReactNode;
  /** The eye button of a row. */
  onQuickView?: (log: T) => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  /** The mobile filter modal; its trigger lives in the search toolbar. */
  mobileFilterOpen?: boolean;
  onMobileFilterClose?: () => void;
  /** Told when the search toolbar should hide: there is nothing to search yet. */
  onHideSearchChange?: (hide: boolean) => void;
  /** How the onboarding empty state is drawn. Default: the plain `NoData` panel. */
  renderEmptyState?: (props: NoDataProps) => ReactNode;
  guideButton?: LogsTableGuideButton;
  /** Columns left out (a narrow rendering). */
  hiddenColumns?: readonly LogsTableColumnId[];
}

const noop = () => {};

/**
 * The logs table: its columns, rows, filters, empty and loading states. The host
 * loads the rows and owns the filter, search and date state.
 */
export function LogsTableView<T extends UiLogEntry = UiLogEntry>({
  logs,
  loading = false,
  facets,
  filters,
  onFilterChange,
  search,
  dateFilter,
  logIdHeader,
  deviceScoped = false,
  organizationLocked = false,
  getLogHref,
  renderCopyAction,
  onQuickView,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore = noop,
  mobileFilterOpen = false,
  onMobileFilterClose = noop,
  onHideSearchChange,
  renderEmptyState,
  guideButton,
  hiddenColumns,
}: LogsTableViewProps<T>) {
  const columns = useMemo<ColumnDef<T>[]>(() => {
    const multiSelect = multiSelectFor<T>();
    const all: ColumnDef<T>[] = [
      {
        accessorKey: 'logId',
        header: logIdHeader ? () => logIdHeader : 'Log ID',
        cell: ({ row }: { row: Row<T> }) => (
          <div className="flex shrink-0 flex-col justify-center">
            <TruncateText>{row.original.timestamp}</TruncateText>
            <TruncateText variant="h6" tone="secondary">
              {row.original.logId}
            </TruncateText>
          </div>
        ),
        enableSorting: false,
        meta: { width: LOG_COLUMN_WIDTHS.logId, alwaysShowHeader: true },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }: { row: Row<T> }) => (
          <div className="shrink-0">
            <Tag label={row.original.status.label} variant={row.original.status.variant} />
          </div>
        ),
        enableSorting: false,
        filterFn: multiSelect,
        meta: {
          width: LOG_COLUMN_WIDTHS.status,
          filter: {
            options:
              facets?.severities.map(severity => ({
                id: severity,
                label: severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase(),
                value: severity,
              })) ?? [],
          },
        },
      },
      {
        accessorKey: 'tool',
        header: 'Tool',
        cell: ({ row }: { row: Row<T> }) => (
          <ToolBadge
            toolType={normalizeToolTypeWithFallback(row.original.source.toolType)}
            iconClassName="h-4 w-4 content-md:h-6 content-md:w-6"
          />
        ),
        enableSorting: false,
        filterFn: multiSelect,
        meta: {
          width: LOG_COLUMN_WIDTHS.tool,
          hideAt: 'md',
          filter: {
            options:
              facets?.toolTypes.map(toolType => ({
                id: toolType,
                label: toToolLabel(toolType),
                value: toolType,
              })) ?? [],
          },
        },
      },
      {
        accessorKey: 'source',
        header: 'SOURCE',
        cell: ({ row }: { row: Row<T> }) => {
          const { deviceName, organization } = logSourceLabels(row.original.device);
          return (
            <div className="flex min-h-[60px] flex-col justify-center gap-1 py-2">
              {deviceName && <TruncateText>{deviceName}</TruncateText>}
              {organization && (
                <TruncateText variant="h6" tone="secondary">
                  {organization}
                </TruncateText>
              )}
            </div>
          );
        },
        enableSorting: false,
        filterFn: multiSelect,
        meta: {
          width: LOG_COLUMN_WIDTHS.source,
          hideAt: 'md',
          filter: organizationLocked ? undefined : { options: [...(facets?.organizations ?? [])] },
        },
      },
      {
        accessorKey: 'description',
        header: 'Log Details',
        cell: ({ row }: { row: Row<T> }) => (
          <TruncateText lines={3} className="text-ods-text-secondary text-h6">
            {row.original.description.title}
          </TruncateText>
        ),
        enableSorting: false,
        meta: { width: LOG_COLUMN_WIDTHS.description, hideAt: 'lg' },
      },
      {
        id: 'copy',
        cell: ({ row }: { row: Row<T> }) => (
          <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
            {renderCopyAction?.(row.original)}
          </div>
        ),
        enableSorting: false,
        meta: { width: `${LOG_COLUMN_WIDTHS.action} ml-auto`, align: 'right' },
      },
      {
        id: 'quickView',
        cell: ({ row }: { row: Row<T> }) => (
          <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
            <Button
              onClick={() => onQuickView?.(row.original)}
              variant="outline"
              size="icon"
              leftIcon={<EyeIcon className="h-5 w-5" />}
              aria-label="Quick view"
              className="bg-ods-card"
            />
          </div>
        ),
        enableSorting: false,
        meta: { width: LOG_COLUMN_WIDTHS.action, align: 'right' },
      },
      {
        id: 'open',
        cell: ({ row }: { row: Row<T> }) => (
          <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
            <Button
              onClick={getLogHref ? openInNewTab(getLogHref(row.original)) : undefined}
              variant="outline"
              size="icon"
              leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
              aria-label="Open in new tab"
              className="bg-ods-card"
            />
          </div>
        ),
        enableSorting: false,
        meta: { width: LOG_COLUMN_WIDTHS.action, hideAt: 'md', align: 'right' },
      },
    ];
    if (!hiddenColumns?.length) return all;
    return all.filter(column => !hiddenColumns.includes(columnId(column) as LogsTableColumnId));
  }, [facets, getLogHref, organizationLocked, logIdHeader, renderCopyAction, onQuickView, hiddenColumns]);

  // Mobile filter groups reuse the column filter options the desktop headers
  // show, so the modal is never empty.
  const filterGroups = useMemo(
    () =>
      columns
        .filter(column => column.meta?.filter?.options)
        .map(column => ({
          id: columnId(column),
          title: typeof column.header === 'string' ? column.header : '',
          options: column.meta?.filter?.options || [],
        })),
    [columns],
  );

  const columnFilters = useMemo(
    () =>
      Object.entries(filters)
        .filter(([, value]) => value && value.length > 0)
        .map(([id, value]) => ({ id, value })),
    [filters],
  );

  const handleColumnFiltersChange = useCallback(
    // TanStack's updater signature: either the next state or a reducer over it.
    (updater: ColumnFilterState | ((prev: ColumnFilterState) => ColumnFilterState)) => {
      const next = typeof updater === 'function' ? updater(columnFilters) : updater;
      const nextFilters: Record<string, string[]> = {};
      for (const f of next) {
        nextFilters[f.id] = Array.isArray(f.value) ? (f.value as string[]) : [String(f.value)];
      }
      onFilterChange(nextFilters);
    },
    [columnFilters, onFilterChange],
  );

  const table = useDataTable<T>({
    data: logs,
    columns,
    getRowId: (row: T) => row.id,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange: handleColumnFiltersChange,
  });

  const hasActiveFilters = Object.values(filters).some(values => values.length > 0);
  // The applied date range counts as a query too: an empty result must keep
  // the table header so the date filter stays reachable to pick another period.
  const hasQuery = Boolean(search) || hasActiveFilters || Boolean(dateFilter?.range);
  const noRows = !loading && logs.length === 0;

  // The standalone page and a device tab share the onboarding empty state when
  // there is no data at all (no query). An empty result under an active query
  // keeps the table chrome below.
  const showEmptyState = !organizationLocked && !hasQuery && noRows;

  // Scoped (device or organization) tabs: when the table is empty, hide the
  // column header and render the unified `DataTable.Body` empty state.
  const scoped = deviceScoped || organizationLocked;
  const scopedEmpty = scoped && noRows;

  // The search field lives outside this view. It hides for the onboarding empty
  // state and for an empty scoped tab, and stays while a query is active so the
  // query can be cleared.
  const hideSearch = showEmptyState || (scopedEmpty && !hasQuery);
  useEffect(() => {
    onHideSearchChange?.(hideSearch);
  }, [hideSearch, onHideSearchChange]);

  if (showEmptyState) {
    // A device tab shows the message only: the onboarding rows and the guide
    // button belong to the standalone page.
    const emptyProps: NoDataProps = deviceScoped
      ? { icon: <ClipboardListIcon />, title: EMPTY_TITLE, description: EMPTY_DESCRIPTION }
      : {
          icon: <ClipboardListIcon />,
          title: EMPTY_TITLE,
          description: EMPTY_DESCRIPTION,
          actions: [
            { icon: <EyeAltIcon />, label: 'Track who did what, when, and on which device' },
            { icon: <Filter01ListIcon />, label: 'Filter by user, action type, Customer, or date range' },
            { icon: <SearchIcon />, label: 'Investigate incidents and audit security events' },
          ],
          ...guideButton,
        };
    return <>{renderEmptyState ? renderEmptyState(emptyProps) : <NoData {...emptyProps} />}</>;
  }

  return (
    <>
      <DataTable table={table}>
        {/* Keep the header while a query (search, filters, date range) is active,
            even with zero rows: its controls are the only way to change it. */}
        {!(scopedEmpty && !hasQuery) && (
          <DataTable.Header stickyHeader stickyHeaderOffset="top-[96px]" rightSlot={<DataTable.RowCount />} />
        )}
        <DataTable.Body
          loading={loading}
          skeletonRows={10}
          // Scoped tabs get the unified empty state (as every other device and
          // customer tab); the standalone page keeps its inline message.
          {...(scoped
            ? {
                emptyState: {
                  icon: <ClipboardListIcon />,
                  title: 'No logs found',
                  description: hasQuery
                    ? 'No results. Try adjusting your search or filters.'
                    : deviceScoped
                      ? 'Logs for this device will appear here.'
                      : 'Logs for this customer will appear here.',
                },
              }
            : { emptyMessage: 'No logs found. Try adjusting your search or filters.' })}
          rowHref={getLogHref}
          rowClassName="mb-1"
        />
        <DataTable.InfiniteFooter
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={onLoadMore}
          skeletonRows={2}
        />
      </DataTable>

      <FilterModal
        isOpen={mobileFilterOpen}
        onClose={onMobileFilterClose}
        filterGroups={filterGroups}
        onFilterChange={onFilterChange}
        currentFilters={filters}
        // Date sort and range: the last section, committed together with the
        // group filters.
        dateFilter={
          dateFilter
            ? {
                title: 'Date',
                sort: dateFilter.sortDirection,
                range: dateFilter.range,
                onChange: dateFilter.onApply,
              }
            : undefined
        }
      />
    </>
  );
}

function columnId<T>(column: ColumnDef<T>): string {
  return String(column.id ?? (column as { accessorKey?: string }).accessorKey ?? '');
}

// ----------------------------------------------------------------
// Loading skeleton
// ----------------------------------------------------------------

const EMPTY_LOG_ROWS: unknown[] = [];

/**
 * A filterable column while the facets are still in flight: no options, plus the
 * flag saying they are coming. The flag keeps the funnel drawn (inert); an empty
 * filter without it means "there is nothing to filter by", and the table hides
 * the funnel for that column.
 */
const PENDING_FILTER = { options: [] as never[], pending: true };

export interface LogsTableSkeletonProps {
  /** The Log ID header in its inert form, so the icon does not arrive with the data. */
  logIdHeader?: ReactNode;
}

/**
 * Loading fallback of the logs table: an empty `DataTable` with the table's own
 * columns, so the header row and the column widths match the loaded table.
 */
export function LogsTableSkeleton({ logIdHeader }: LogsTableSkeletonProps) {
  const columns = useMemo<ColumnDef<unknown>[]>(() => {
    const multiSelect = multiSelectFor<unknown>();
    return [
      {
        id: 'logId',
        header: logIdHeader ? () => logIdHeader : 'Log ID',
        enableSorting: false,
        meta: { width: LOG_COLUMN_WIDTHS.logId, alwaysShowHeader: true },
      },
      {
        id: 'status',
        header: 'Status',
        enableSorting: false,
        filterFn: multiSelect,
        meta: { width: LOG_COLUMN_WIDTHS.status, filter: PENDING_FILTER },
      },
      {
        id: 'tool',
        header: 'Tool',
        enableSorting: false,
        filterFn: multiSelect,
        meta: { width: LOG_COLUMN_WIDTHS.tool, hideAt: 'md', filter: PENDING_FILTER },
      },
      {
        id: 'source',
        header: 'SOURCE',
        enableSorting: false,
        filterFn: multiSelect,
        meta: { width: LOG_COLUMN_WIDTHS.source, hideAt: 'md', filter: PENDING_FILTER },
      },
      {
        id: 'description',
        header: 'Log Details',
        enableSorting: false,
        meta: { width: LOG_COLUMN_WIDTHS.description, hideAt: 'lg' },
      },
      {
        id: 'copy',
        enableSorting: false,
        meta: { width: `${LOG_COLUMN_WIDTHS.action} ml-auto`, align: 'right' },
      },
      {
        id: 'quickView',
        enableSorting: false,
        meta: { width: LOG_COLUMN_WIDTHS.action, align: 'right' },
      },
      {
        id: 'open',
        enableSorting: false,
        meta: { width: LOG_COLUMN_WIDTHS.action, hideAt: 'md', align: 'right' },
      },
    ];
  }, [logIdHeader]);

  const table = useDataTable<unknown>({
    data: EMPTY_LOG_ROWS,
    columns,
    getRowId: () => '',
    enableSorting: false,
  });

  return (
    <DataTable table={table}>
      <DataTable.Header stickyHeader stickyHeaderOffset="top-[96px]" />
      <DataTable.Body loading={true} skeletonRows={10} emptyMessage="" rowClassName="mb-1" />
    </DataTable>
  );
}

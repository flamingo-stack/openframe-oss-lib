'use client';

import { type MouseEvent, type ReactNode, useCallback, useEffect, useMemo } from 'react';
import { openInNewTab } from '../../../utils/open-in-new-tab';
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
import {
  type ColumnDef,
  DataTable,
  dataTableLoadingRows,
  GRID_ACTION_COLUMN_SIZE,
  GRID_MIN_WIDTH,
  multiSelectFilterFn,
  type Row,
  useDataTable,
} from '../../ui/data-table';
import { DATA_TABLE_SKELETON_ROWS } from '../../ui/data-table/utils';
import { FilterModal } from '../../ui/filter-modal';
import { useLoadingScope } from '../../ui/loading-scope';
import { NoData, type NoDataProps } from '../../ui/no-data';
import { Tag } from '../../ui/tag';
import { TruncateText } from '../../ui/truncate-text';
import { GRID_ACTION_BUTTON_CLASS, GridTextWithDetailCell } from '../feature-table-grid-cells';
import { dataTableLayoutProps, type FeatureTableLayoutProps } from '../feature-table-layout';
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
export interface LogsTableViewProps<T extends UiLogEntry = UiLogEntry> extends FeatureTableLayoutProps {
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
  /**
   * Header of the Log ID column in the cards layout (the host's date sort and range control). Default: the label. The
   * grid layout draws the column's date header itself, from `dateFilter`.
   */
  logIdHeader?: ReactNode;
  /** The table shows one device's logs (a device tab). */
  deviceScoped?: boolean;
  /** The table is locked to one organization: the Source column has no filter. */
  organizationLocked?: boolean;
  /** Where a row leads; also what the "Open in new tab" button opens. */
  getLogHref?: (log: T) => string;
  /**
   * The row's copy action (the host fetches the full log). In the grid layout the host draws its bare form
   * (`<LogCopyIconButton grid />`): the cell is the button's frame.
   */
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
  /**
   * How many logs one request loads (the host's page size). The loading body draws that many skeleton rows and the
   * load-more footer one more page of them. Default: the table's own defaults (`DataTable.Body` / `InfiniteFooter`).
   */
  pageSize?: number;
}

const noop = () => {};

/** A log still being read: a row the table keys, every field a cell shows empty (each draws its loading form). */
const loadingLog = (id: string): UiLogEntry => ({
  id,
  logId: '',
  timestamp: '',
  status: { label: '' },
  source: { name: '', toolType: '' },
  device: { name: '' },
  description: { title: '' },
});

/** The Source column: the device over its customer; both lines are bars while the row is read. */
function LogSourceCell({ device }: { device: UiLogEntry['device'] }) {
  const loading = useLoadingScope();
  const { deviceName, organization } = logSourceLabels(device);
  return (
    <div className="flex min-h-[60px] flex-col justify-center gap-1 py-2">
      {(deviceName || loading) && <TruncateText>{deviceName}</TruncateText>}
      {(organization || loading) && (
        <TruncateText variant="h6" tone="secondary">
          {organization ?? ''}
        </TruncateText>
      )}
    </div>
  );
}

/** The grid's Source cell: the device, then its customer on the same line. */
function LogSourceGridCell({ device }: { device: UiLogEntry['device'] }) {
  const { deviceName, organization } = logSourceLabels(device);
  return <GridTextWithDetailCell text={deviceName} detail={organization} />;
}

/** A row's icon button (quick view, open in a new tab): static chrome, drawn real and inert while the row is read. */
function LogRowButton({
  onClick,
  icon,
  label,
  grid = false,
}: {
  onClick?: (event: MouseEvent) => void;
  icon: ReactNode;
  label: string;
  /** The grid layout's form: a bare 40px icon button, the cell being its frame. */
  grid?: boolean;
}) {
  const loading = useLoadingScope();
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <Button
        onClick={loading ? undefined : onClick}
        disabled={loading}
        variant={grid ? 'transparent' : 'outline'}
        size="icon"
        leftIcon={icon}
        aria-label={label}
        className={grid ? GRID_ACTION_BUTTON_CLASS : 'bg-ods-card'}
      />
    </div>
  );
}

/**
 * The logs table: its columns, rows, filters, empty and loading states. The host
 * loads the rows and owns the filter, search and date state.
 */
export function LogsTableView<T extends UiLogEntry = UiLogEntry>({
  logs,
  loading: loadingProp = false,
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
  pageSize,
  layout = 'cards',
  tableMaxHeight,
  tableSettings,
}: LogsTableViewProps<T>) {
  // ONE switch: in a page's loading state the table is loading (its body draws the row skeletons, never the empty state).
  const loading = useLoadingScope() || loadingProp;
  const grid = layout === 'grid';
  const columns = useMemo<ColumnDef<T>[]>(() => {
    const multiSelect = multiSelectFor<T>();
    const quickView = (log: T, inGrid: boolean) => (
      <LogRowButton
        onClick={() => onQuickView?.(log)}
        icon={<EyeIcon className="h-5 w-5" />}
        label="Quick view"
        grid={inGrid}
      />
    );
    const open = (log: T, inGrid: boolean) => (
      <LogRowButton
        onClick={getLogHref ? openInNewTab(getLogHref(log)) : undefined}
        icon={<ArrowRightUpIcon className="h-5 w-5" />}
        label="Open in new tab"
        grid={inGrid}
      />
    );
    const copy = (log: T) => (
      <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
        {renderCopyAction?.(log)}
      </div>
    );
    const all: ColumnDef<T>[] = [
      {
        accessorKey: 'logId',
        // The grid header is the table's own date header (`meta.dateFilter`), which needs the label as text; a card
        // header is the host's control.
        header: !grid && logIdHeader ? () => logIdHeader : 'Log ID',
        cell: ({ row }: { row: Row<T> }) => (
          <div className="flex shrink-0 flex-col justify-center">
            <TruncateText>{row.original.timestamp}</TruncateText>
            <TruncateText variant="h6" tone="secondary">
              {row.original.logId}
            </TruncateText>
          </div>
        ),
        enableSorting: false,
        size: 320,
        meta: {
          label: 'Log ID',
          width: LOG_COLUMN_WIDTHS.logId,
          alwaysShowHeader: true,
          dateFilter,
          // The time stays whole; the id after it is the part a narrow column cuts.
          gridCell: ({ row }) => <GridTextWithDetailCell text={row.original.timestamp} detail={row.original.logId} />,
        },
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
        size: 160,
        meta: {
          label: 'Status',
          width: LOG_COLUMN_WIDTHS.status,
          gridCell: ({ row }) => (
            <DataTable.Cell tag={<Tag label={row.original.status.label} variant={row.original.status.variant} />} />
          ),
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
        size: 200,
        minSize: GRID_MIN_WIDTH.icon,
        meta: {
          label: 'Tool',
          width: LOG_COLUMN_WIDTHS.tool,
          hideAt: 'md',
          gridCell: ({ row }) => (
            <ToolBadge
              toolType={normalizeToolTypeWithFallback(row.original.source.toolType)}
              iconClassName="h-5 w-5"
              // One line: the label is the part cut, the mark keeps its size.
              className="min-w-0 [&>span]:min-w-0 [&>span]:truncate"
            />
          ),
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
        cell: ({ row }: { row: Row<T> }) => <LogSourceCell device={row.original.device} />,
        enableSorting: false,
        filterFn: multiSelect,
        size: 280,
        meta: {
          label: 'Source',
          width: LOG_COLUMN_WIDTHS.source,
          hideAt: 'md',
          gridCell: ({ row }) => <LogSourceGridCell device={row.original.device} />,
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
        // The last data column: it takes the width the others leave.
        size: 400,
        meta: {
          label: 'Log details',
          width: LOG_COLUMN_WIDTHS.description,
          hideAt: 'lg',
          gridCell: ({ row }) => <DataTable.Cell text={row.original.description.title} />,
        },
      },
      {
        id: 'copy',
        cell: ({ row }: { row: Row<T> }) => copy(row.original),
        enableSorting: false,
        size: GRID_ACTION_COLUMN_SIZE,
        meta: { width: `${LOG_COLUMN_WIDTHS.action} ml-auto`, align: 'right', gridKind: 'action' },
      },
      {
        id: 'quickView',
        cell: ({ row }: { row: Row<T> }) => quickView(row.original, false),
        enableSorting: false,
        size: GRID_ACTION_COLUMN_SIZE,
        meta: {
          width: LOG_COLUMN_WIDTHS.action,
          align: 'right',
          gridKind: 'action',
          gridCell: ({ row }) => quickView(row.original, true),
        },
      },
      {
        id: 'open',
        cell: ({ row }: { row: Row<T> }) => open(row.original, false),
        enableSorting: false,
        size: GRID_ACTION_COLUMN_SIZE,
        // Kept by hand, not `actionColumn()`: the cards table hides the button below `md`.
        meta: {
          width: LOG_COLUMN_WIDTHS.action,
          hideAt: 'md',
          align: 'right',
          gridKind: 'action',
          gridCell: ({ row }) => open(row.original, true),
        },
      },
    ];
    if (!hiddenColumns?.length) return all;
    return all.filter(column => !hiddenColumns.includes(columnId(column) as LogsTableColumnId));
  }, [
    facets,
    getLogHref,
    organizationLocked,
    logIdHeader,
    dateFilter,
    grid,
    renderCopyAction,
    onQuickView,
    hiddenColumns,
  ]);

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

  // While loading the table holds one page of placeholder rows, drawn with the real cells (`loadingCells`).
  const loadingRows = useMemo(
    () => (loading ? dataTableLoadingRows(pageSize ?? DATA_TABLE_SKELETON_ROWS, id => loadingLog(id) as T) : null),
    [loading, pageSize],
  );
  const table = useDataTable<T>({
    data: loadingRows ?? logs,
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
  // Keep the header while a query (search, filters, date range) is active, even with zero rows: its controls are
  // the only way to change it.
  const showHeader = !(scopedEmpty && !hasQuery);

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
      <DataTable table={table} {...dataTableLayoutProps({ layout, tableMaxHeight, tableSettings })}>
        {/* The grid's results count sits above the table; the card header carries its own (`rightSlot`). */}
        {showHeader && grid && (
          <DataTable.Meta>
            <DataTable.RowCount loading={loading} />
          </DataTable.Meta>
        )}
        {showHeader && (
          <DataTable.Header
            stickyHeader
            // Under the page's search toolbar (`LogsPageView` publishes its height); 96px,
            // the desktop toolbar's, where no page view measures one.
            stickyHeaderOffset="top-[var(--sticky-toolbar-h,96px)]"
            rightSlot={<DataTable.RowCount loading={loading} />}
            loading={loading}
          />
        )}
        <DataTable.Body
          loading={loading}
          loadingCells
          skeletonRows={pageSize}
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
          skeletonRows={pageSize}
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

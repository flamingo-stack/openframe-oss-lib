'use client';

import type { ReactNode, RefObject } from 'react';
import { cn } from '../../../utils/cn';
import { AlertTriangleIcon } from '../../icons-v2-generated';
import {
  Alert,
  type ColumnDef,
  type ColumnFiltersState,
  DataTable,
  type OnChangeFn,
  type PageActionButton,
  PageLayout,
  TabSelector,
} from '../../ui';
import { DevicesFilterToolbar, type DevicesFilterToolbarProps } from './devices-filter-toolbar';
import { DevicesGrid } from './devices-grid';
import { DevicesGridFilters } from './devices-grid-filters';
import { DEVICE_VIEW_MODE_ITEMS } from './devices-panel-header';
import { DevicesTableBody, type DeviceFilterColumn, getDeviceFilterColumns } from './devices-table-columns';
import type { DeviceFilters, DeviceRow } from './types';

export type DevicesViewMode = 'table' | 'grid';

const NO_FILTERS: Record<string, string[]> = {};
const NO_TAGS: never[] = [];
const NO_FILTER_GROUPS: never[] = [];
const noop = () => {};

/** A toolbar with nothing in it and nothing wired: what a loading panel and a picture draw. */
export const IDLE_DEVICES_TOOLBAR: DevicesFilterToolbarProps = {
  searchValue: '',
  onSearchChange: noop,
  tags: NO_TAGS,
  onTagRemove: noop,
  onClearAll: noop,
  onSubmit: noop,
  onOpenFilterModal: noop,
  isFilterModalOpen: false,
  onCloseFilterModal: noop,
  filterGroups: NO_FILTER_GROUPS,
  onFilterChange: noop,
  tagFilterKeys: NO_TAGS,
  selectedTags: NO_TAGS,
  onTagsChange: noop,
};

export interface DevicesPanelViewProps<T extends DeviceRow = DeviceRow> {
  /** Page title shown in the PageLayout header. */
  title?: string;
  /** Back button rendered above the title (e.g. on the archive page). */
  backButton?: { label?: string; onClick: () => void };
  /** The PageLayout wrapper's className, already resolved by the caller. */
  className?: string;
  /**
   * Drawn in place of the panel's own header (title, view switch, actions),
   * for a host that brings its own, such as a page hero.
   */
  headerSlot?: ReactNode;

  viewMode: DevicesViewMode;
  onViewModeChange?: (mode: DevicesViewMode) => void;
  /** Header buttons: see `buildDevicePanelActions`. */
  actions?: PageActionButton[];

  /** The rows to draw, already narrowed. The view never fetches and never filters. */
  devices: T[];
  /**
   * The request has not answered: the header, the view switch and the toolbar
   * are the real ones, locked, and only the rows are skeletons.
   */
  loading?: boolean;
  /** The rows on screen answer the previous narrowing while the next loads: dimmed, not replaced. */
  isNarrowing?: boolean;
  /** Server-side total for the current narrowing. */
  totalCount?: number;

  /** Facets behind the column funnels and the grid's filter row, from the server. */
  deviceFilters?: DeviceFilters | null;
  /** The filter columns the grid row offers. Defaults to every column of `deviceFilters` not in `hideFilters`. */
  filterColumns?: DeviceFilterColumn[];
  /** Search box, tag chips and the tags modal. Omit for an idle toolbar. */
  toolbar?: DevicesFilterToolbarProps;
  /** The table's column funnels. */
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;
  /** The grid filter row's selection, keyed by column id, and its writer. */
  gridFilters?: Record<string, string[]>;
  onGridFiltersChange?: (filters: Record<string, string[]>) => void;

  /** The row-actions column: see `getDeviceActionsColumn`. */
  actionsColumn?: ColumnDef<T>;
  /** Column ids to drop from the table (e.g. 'organization' when scoped to one customer). */
  hideColumns?: string[];
  /** Filter keys to drop from the funnels and the grid row; the column itself stays. */
  hideFilters?: string[];
  /** Message shown when the list is empty. */
  emptyMessage?: string;
  /** Drawn instead of the toolbar and the list: the pristine, genuinely empty panel. */
  emptyState?: ReactNode;
  /** The tenant has no customers yet: a banner says a device needs one. */
  noOrganizations?: boolean;

  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  /** The grid's infinite-scroll sentinel. */
  gridSentinelRef?: RefObject<HTMLDivElement | null>;
}

/**
 * The device list as a page: header with the table / grid switch and the
 * actions, the search and tag toolbar, and the rows as a table or as cards.
 *
 * Everything it shows is a prop. The product's container owns the queries and
 * the URL state and maps them here; a fixture passes plain rows. Its loading
 * state is the same component with `loading`: the chrome is the real one,
 * locked, so the page does not move when the rows land.
 */
export function DevicesPanelView<T extends DeviceRow = DeviceRow>({
  title = 'Devices',
  backButton,
  className = '',
  headerSlot,
  viewMode,
  onViewModeChange,
  actions,
  devices,
  loading = false,
  isNarrowing = false,
  totalCount,
  deviceFilters = null,
  filterColumns,
  toolbar = IDLE_DEVICES_TOOLBAR,
  columnFilters,
  onColumnFiltersChange,
  gridFilters = NO_FILTERS,
  onGridFiltersChange = noop,
  actionsColumn,
  hideColumns,
  hideFilters,
  emptyMessage = 'No devices found. Try adjusting your search or filters.',
  emptyState,
  noOrganizations = false,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore = noop,
  gridSentinelRef,
}: DevicesPanelViewProps<T>) {
  const gridColumns =
    filterColumns ?? getDeviceFilterColumns(deviceFilters).filter(column => !hideFilters?.includes(column.key));

  const list = (
    <>
      <DevicesFilterToolbar {...toolbar} isLoading={loading} />
      {viewMode === 'table' ? (
        <DevicesTableBody
          devices={devices}
          isLoading={loading}
          emptyMessage={loading ? '' : emptyMessage}
          skeletonRows={10}
          stickyHeaderOffset="top-[96px]"
          deviceFilters={deviceFilters}
          // Loading: the facets have not answered, which is not "this list has
          // no facets". Without it the empty options read as final and each
          // column's funnel is hidden, so the header grew them when the query
          // landed. Loaded: the facets arrive with the rows, nothing is pending.
          filtersPending={loading || undefined}
          columnFilters={columnFilters}
          onColumnFiltersChange={onColumnFiltersChange}
          actionsColumn={actionsColumn}
          hideColumns={hideColumns}
          disableColumnFilters={hideFilters}
          totalCount={loading ? undefined : totalCount}
          footerSlot={
            loading ? undefined : (
              <DataTable.InfiniteFooter
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                onLoadMore={onLoadMore}
                skeletonRows={2}
              />
            )
          }
        />
      ) : (
        <>
          {/* Loading: the labels are static, so the row holds its height; the
              count is the query's answer and its tail is absolutely positioned,
              so leaving it out moves nothing. */}
          <DevicesGridFilters
            filterColumns={gridColumns}
            currentFilters={gridFilters}
            onFilterChange={onGridFiltersChange}
            totalCount={loading ? undefined : totalCount}
            isLoading={loading}
          />
          <DevicesGrid
            devices={devices}
            isLoading={loading}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            sentinelRef={gridSentinelRef}
            emptyMessage={loading ? '' : emptyMessage}
          />
        </>
      )}
    </>
  );

  return (
    <PageLayout
      title={title}
      backButton={backButton}
      showHeader={!headerSlot}
      actionsVariant="icon-buttons"
      className={className}
      selector={
        <TabSelector
          value={viewMode}
          onValueChange={value => onViewModeChange?.(value as DevicesViewMode)}
          items={DEVICE_VIEW_MODE_ITEMS}
          disabled={loading}
        />
      }
      actions={actions}
      contentClassName="flex flex-col"
    >
      {headerSlot}
      {loading && (
        <span role="status" className="sr-only">
          Loading devices…
        </span>
      )}
      {noOrganizations && !loading && (
        // Core Alert restyled to the ODS warning tokens. The icon is wrapped in a
        // span so Alert's `[&>svg]` absolute-positioning rules don't apply.
        <Alert className="mb-[var(--spacing-system-l)] flex items-start gap-[var(--spacing-system-m)] rounded-[6px] border-0 bg-ods-warning-secondary text-ods-warning">
          <span className="shrink-0">
            <AlertTriangleIcon className="h-6 w-6" />
          </span>
          <p className="text-h3">Add a customer to connect a new device</p>
        </Alert>
      )}
      {emptyState && !loading ? (
        emptyState
      ) : loading ? (
        // `inert` rather than per-control `disabled`: the toolbar's search field
        // and tag chips have no disabled state of their own, and a focusable
        // input that silently drops what is typed into it is worse than one
        // that cannot be reached at all.
        <div inert>{list}</div>
      ) : (
        // Dimmed, not skeletoned, while a filter or search change resolves: the
        // rows on screen are the previous answer and stay readable until the
        // next one arrives.
        <div className={cn(isNarrowing && 'opacity-60 transition-opacity')}>{list}</div>
      )}
    </PageLayout>
  );
}

'use client';

import { type ReactNode, useCallback, useMemo } from 'react';
import { type ColumnFiltersState, DataTable, type NoDataProps, type OnChangeFn } from '../../ui';
import { DevicesFilterToolbar } from './devices-filter-toolbar';
import { DevicesTableBody, getDeviceActionsColumn, getDeviceFilterColumns } from './devices-table-columns';
import type { DeviceFilters, DeviceRow } from './types';
import { useStickyToolbar } from './use-sticky-toolbar';
import { useTagFilterModal } from './use-tag-filter-modal';

/**
 * What the user has narrowed the list down to. One shape for every surface, so a
 * caller can keep it in the URL, in local state, or hand it straight to a server
 * filter without translating between vocabularies.
 */
export interface DevicesListNarrowing {
  search: string;
  statuses: string[];
  osTypes: string[];
  organizationIds: string[];
  /** Chips as typed. `key:value` narrows; a bare word stays visible and filters nothing. */
  tags: string[];
}

export const EMPTY_DEVICES_NARROWING: DevicesListNarrowing = {
  search: '',
  statuses: [],
  osTypes: [],
  organizationIds: [],
  tags: [],
};

/** True when anything at all is narrowing the list, an empty list then means "no matches", not "nothing here". */
export function isNarrowed(narrowing: DevicesListNarrowing): boolean {
  return (
    narrowing.search.trim().length > 0 ||
    narrowing.statuses.length > 0 ||
    narrowing.osTypes.length > 0 ||
    narrowing.organizationIds.length > 0 ||
    narrowing.tags.length > 0
  );
}

export interface DevicesListProps<T extends DeviceRow = DeviceRow> {
  /**
   * The rows to render, already narrowed. This component never filters and never
   * fetches, see the module docstring.
   */
  devices: T[];
  isLoading?: boolean;

  /**
   * Facet counts behind the column funnels and the mobile filter modal, **from
   * the server**, the `deviceFilters` query, scoped the same way the rows are.
   *
   * NEVER derive these from `devices`. Counts computed off the loaded rows read
   * as facts about the list and are not: they change with every page fetched and
   * disagree with the server the moment anything is narrowed. A surface with no
   * facet query of its own passes `null` (or omits this) and the table drops the
   * funnels entirely, a control that opens onto nothing is worse than none.
   */
  deviceFilters?: DeviceFilters | null;
  /**
   * The facet query has not answered yet, keeps the funnels drawn but inert,
   * so they don't appear out of nowhere when it does. Key it on the DATA
   * (`!deviceFilters`), never on a react-query `isLoading`, which reads false
   * before the request has started.
   */
  filtersPending?: boolean;

  /**
   * True while the rows on screen are the PREVIOUS result and a refetch is in
   * flight (deferred query variables, see `useDeferredQuery`). Dims them,
   * rather than tearing the list down to a skeleton on every keystroke.
   */
  isPending?: boolean;

  /**
   * Row count beside the column header: the server's total for the CURRENT
   * narrowing (a connection's `filteredCount`), not the number of rows fetched
   * so far. Honest at any point precisely because the narrowing is the server's
   * too, a count taken from a client-side filter would contradict it.
   */
  totalCount?: number;

  /** Controlled narrowing. Omit both to render a read-only list (skeletons, previews). */
  narrowing?: DevicesListNarrowing;
  onNarrowingChange?: (next: DevicesListNarrowing) => void;

  /** Column ids to drop, e.g. `['organization']` when the list is already scoped to one customer. */
  hideColumns?: string[];
  /** Filter keys to drop from the funnels AND the modal; the column itself stays. */
  hideFilters?: string[];
  /** Per-row overflow menu. Omit for a read-only list. */
  rowActions?: (device: T) => ReactNode;

  /**
   * Shown when the list is empty and nothing is narrowing it, the design's
   * `data-placeholder`: icon over title over description, rendered by the
   * table's own `DataTableEmpty`.
   */
  emptyState?: NoDataProps;
  /**
   * Shown when narrowing is what emptied it. Defaults to the table's standard
   * "no results" state (search icon, "Try adjusting your search or filters"),
   * which is the right answer on every list, override only to name the rows.
   */
  narrowedEmptyState?: NoDataProps;

  skeletonRows?: number;
  infiniteScroll?: {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    onLoadMore: () => void;
    skeletonRows?: number;
  };

  /**
   * Pins the search / tag toolbar to the top of the scroll area, as the fleet
   * list does. On by default: a list long enough to scroll is exactly the one
   * whose search must stay reachable. Turn it off only where something else is
   * already pinned at the top.
   */
  stickyToolbar?: boolean;
  /**
   * Overrides the wrapper around the toolbar and the table. By default it adds
   * NO gap while the toolbar is pinned, the pinned row carries its own `p-l`,
   * and a gap on top of it doubles the space under the search box.
   */
  /**
   * Where the column header parks once the rows scroll under it. Defaults to the
   * MEASURED height of the pinned toolbar, so the two never overlap and never
   * leave a gap, the toolbar grows and shrinks with the tag-chip row, and is
   * shorter on a phone. Only pass this to park the header somewhere else.
   */
  stickyHeaderOffset?: string;
  className?: string;
}

const NOOP = () => {};

/**
 * The devices list, search + tag chips + column funnels over the shared devices
 * table, identical on every surface that shows devices.
 *
 * **It does not fetch, and it does not filter.** That is the whole point: in
 * Relay the rows are a CONNECTION, and every surface has a different one
 * (`devices` for the fleet, `scriptSchedule.assignedDevices` for a schedule's
 * assignment, `availableDevices` for its picker). Baking a query in would tie
 * the list to exactly one of them; taking `devices` + a controlled
 * {@link DevicesListNarrowing} lets one component serve all of them.
 *
 * It follows that the narrowing this component reports belongs in the caller's
 * QUERY, every devices connection takes the same `filter` / `search`, so every
 * surface narrows server-side, over the whole list rather than the pages fetched
 * so far. The funnel options come from the server too (`deviceFilters`), or not
 * at all; see the `deviceFilters` prop.
 *
 * The rows-in / narrowing-out split is also what makes the two data layers
 * coexist: the fleet list is still react-query over raw POST, the schedule reads
 * Relay. When devices move to Relay, the natural next step is a colocated
 * fragment on `Device` that each caller spreads on its own connection, the
 * props here do not change.
 */
export function DevicesList<T extends DeviceRow = DeviceRow>({
  devices,
  isLoading,
  deviceFilters = null,
  filtersPending,
  isPending,
  totalCount,
  narrowing = EMPTY_DEVICES_NARROWING,
  onNarrowingChange = NOOP,
  hideColumns,
  hideFilters,
  rowActions,
  emptyState,
  narrowedEmptyState,
  skeletonRows = 8,
  infiniteScroll,
  stickyToolbar = true,
  stickyHeaderOffset,
  className,
}: DevicesListProps<T>) {
  const patch = useCallback(
    (next: Partial<DevicesListNarrowing>) => onNarrowingChange({ ...narrowing, ...next }),
    [narrowing, onNarrowingChange],
  );

  const filterColumns = useMemo(() => {
    const hidden = new Set(hideFilters ?? []);
    return getDeviceFilterColumns(deviceFilters).filter(column => !hidden.has(column.key));
  }, [deviceFilters, hideFilters]);

  // The column funnels speak in column ids; the narrowing speaks in the backend's
  // field names. This pair is the only place that translation lives.
  const columnFilters = useMemo<ColumnFiltersState>(
    () => [
      ...(narrowing.statuses.length ? [{ id: 'status', value: narrowing.statuses }] : []),
      ...(narrowing.osTypes.length ? [{ id: 'os', value: narrowing.osTypes }] : []),
      ...(narrowing.organizationIds.length ? [{ id: 'organization', value: narrowing.organizationIds }] : []),
    ],
    [narrowing.statuses, narrowing.osTypes, narrowing.organizationIds],
  );

  const onColumnFiltersChange = useCallback<OnChangeFn<ColumnFiltersState>>(
    updater => {
      const next = typeof updater === 'function' ? updater(columnFilters) : updater;
      const pick = (id: string) => (next.find(f => f.id === id)?.value as string[] | undefined) ?? [];
      patch({ statuses: pick('status'), osTypes: pick('os'), organizationIds: pick('organization') });
    },
    [columnFilters, patch],
  );

  // The mobile modal hands back one flat params object keyed by backend field.
  const handleModalParams = useCallback(
    (params: Record<string, unknown>) => {
      const pick = (key: string) => (params[key] as string[] | undefined) ?? [];
      patch({
        statuses: pick('statuses'),
        osTypes: pick('osTypes'),
        organizationIds: pick('organizationIds'),
        tags: pick('tags'),
      });
    },
    [patch],
  );

  const {
    isOpen: filterModalOpen,
    open: openFilterModal,
    close: closeFilterModal,
    isMdUp,
    filterGroups,
    tagFilterKeys,
    handleFilterChange: handleModalFilterChange,
    handleTagsChange: handleModalTagsChange,
  } = useTagFilterModal({
    tags: narrowing.tags,
    deviceFilters,
    columns: filterColumns,
    setParams: handleModalParams,
  });

  const tagOptions = useMemo(() => narrowing.tags.map(tag => ({ label: tag, value: tag })), [narrowing.tags]);

  // The modal reads the current selection back in column-keyed form.
  const tableFilters = useMemo(
    () => ({ status: narrowing.statuses, os: narrowing.osTypes, organization: narrowing.organizationIds }),
    [narrowing.statuses, narrowing.osTypes, narrowing.organizationIds],
  );

  const handleTagRemove = useCallback(
    (value: string) => patch({ tags: narrowing.tags.filter(tag => tag !== value) }),
    [patch, narrowing.tags],
  );

  const handleTagSubmit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      patch({ search: '', tags: narrowing.tags.includes(trimmed) ? narrowing.tags : [...narrowing.tags, trimmed] });
    },
    [patch, narrowing.tags],
  );

  const handleClearAll = useCallback(() => patch({ search: '', tags: [] }), [patch]);

  const narrowed = isNarrowed(narrowing);

  // Nothing here at all, the design's placeholder, and the one state with
  // nothing to search: the box is dropped rather than left over an empty list.
  // Narrowing that empties the list is NOT this case; there the toolbar is the
  // only way back, so it stays (as does the column header above).
  const isEmptyState = !isLoading && !isPending && !narrowed && devices.length === 0;

  // The toolbar publishes its own height on the wrapper below, and the column
  // header parks at exactly that. Measured, not a constant: the toolbar gains a
  // row when the first tag chip lands and is shorter on a phone, and a fixed
  // offset would either cover the first rows or leave a strip of them showing
  // through above the header.
  const { toolbarRef, containerStyle, stickyHeaderOffset: measuredOffset } = useStickyToolbar();
  const headerOffset = stickyHeaderOffset ?? (stickyToolbar ? measuredOffset : undefined);

  const actionsColumn = useMemo(() => (rowActions ? getDeviceActionsColumn<T>(rowActions) : undefined), [rowActions]);

  return (
    // No gap under a pinned toolbar: its own `p-l` is the space below the search
    // box, and a gap here would double it. An unpinned toolbar has no padding of
    // its own, so there it is the gap that separates the two.
    <div
      className={className ?? (stickyToolbar ? 'flex flex-col' : 'flex flex-col gap-[var(--spacing-system-l)]')}
      style={containerStyle}
    >
      {!isEmptyState && (
        <DevicesFilterToolbar
          sticky={stickyToolbar}
          toolbarRef={toolbarRef}
          searchValue={narrowing.search}
          onSearchChange={value => patch({ search: value })}
          tags={tagOptions}
          onTagRemove={handleTagRemove}
          onClearAll={handleClearAll}
          onSubmit={handleTagSubmit}
          onOpenFilterModal={openFilterModal}
          isFilterModalOpen={filterModalOpen}
          onCloseFilterModal={closeFilterModal}
          filterGroups={filterGroups}
          onFilterChange={handleModalFilterChange}
          currentFilters={isMdUp === false ? tableFilters : undefined}
          tagFilterKeys={tagFilterKeys}
          selectedTags={narrowing.tags}
          onTagsChange={handleModalTagsChange}
        />
      )}

      {/* Dim (don't unmount) the stale rows while a refetch is in flight, the
          subtle fade is the pending feedback, and the search box above keeps its
          focus because nothing under it is torn down. */}
      <div className={`transition-opacity duration-200 ${isPending ? 'opacity-60' : ''}`}>
        <DevicesTableBody
          devices={devices}
          isLoading={isLoading}
          // Column labels above nothing explain nothing, but they stay while
          // loading (the skeleton rows are what they label), while a refetch is
          // pending, and whenever narrowing is what emptied the list, since the
          // funnels live in that header and removing it would strip the only way
          // to undo the filter.
          showHeader={isLoading || isPending || devices.length > 0 || narrowed}
          // Narrowed: `undefined` is what asks the table for its own standard
          // "no results found / try adjusting your search or filters" state.
          emptyState={narrowed ? narrowedEmptyState : emptyState}
          skeletonRows={skeletonRows}
          stickyHeaderOffset={headerOffset}
          deviceFilters={deviceFilters}
          filtersPending={filtersPending}
          columnFilters={columnFilters}
          onColumnFiltersChange={onColumnFiltersChange}
          actionsColumn={actionsColumn}
          hideColumns={hideColumns}
          disableColumnFilters={hideFilters}
          totalCount={totalCount}
          footerSlot={
            infiniteScroll && (
              <DataTable.InfiniteFooter
                hasNextPage={infiniteScroll.hasNextPage}
                isFetchingNextPage={infiniteScroll.isFetchingNextPage}
                onLoadMore={infiniteScroll.onLoadMore}
                skeletonRows={infiniteScroll.skeletonRows}
              />
            )
          }
        />
      </div>
    </div>
  );
}

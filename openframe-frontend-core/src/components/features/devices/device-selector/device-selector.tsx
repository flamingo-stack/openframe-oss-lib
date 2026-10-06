'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircleIcon, MonitorIcon, PlusCircleIcon, TrashIcon } from '../../../icons-v2-generated';
import {
  Button,
  type ColumnDef,
  type ColumnFiltersState,
  DataTable,
  EntityImage,
  type OnChangeFn,
  type Row,
  type TabItem,
  TabNavigation,
  Tag,
  TruncateText,
  useDataTable,
} from '../../../ui';
import { OSTypeBadge } from '../../os-type-badge';
import { formatLastOnline } from '../device-last-online';
import { getDeviceName } from '../device-name';
import { getDeviceStatusConfig } from '../device-status';
import { DEVICE_STATUS } from '../device-statuses';
import { DeviceTypeTile } from '../device-type-tile';
import { DevicesFilterToolbar } from '../devices-filter-toolbar';
import { getDeviceFilterColumns } from '../devices-table-columns';
import { useDeviceImageUrl } from '../devices-view-config';
import type { DeviceFilters, DeviceRow } from '../types';
import { useTagFilterModal } from '../use-tag-filter-modal';
import { DeviceSelectionModeRadio } from './device-selection-mode-radio';
import type { DeviceSelectorProps, SubTab } from './device-selector.types';
import { useDeviceSelector } from './use-device-selector';

const EMPTY_SET: ReadonlySet<string> = new Set();
const NOOP = () => {};
const DEFAULT_GET_DEVICE_KEY = (d: DeviceRow): string | undefined => d.machineId || d.id;

/** The CUSTOMER cell: the customer's image, name and primary contact. */
function CustomerCell({ device }: { device: DeviceRow }) {
  const fullImageUrl = useDeviceImageUrl(device.organizationImageUrl, device.organizationImageHash);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <EntityImage
        src={fullImageUrl}
        alt={device.organization || 'Customer'}
        className="size-10 shrink-0 content-md:size-10"
      />
      <div className="flex min-w-0 flex-col justify-center">
        <TruncateText>{device.organization || ''}</TruncateText>
        {device.organizationEmail && (
          <TruncateText variant="h6" tone="secondary">
            {device.organizationEmail}
          </TruncateText>
        )}
      </div>
    </div>
  );
}

/**
 * Selection-oriented devices list. Sits next to `DevicesPanel` (the listing
 * page), but the data model is different and intentional:
 *
 * - **Data is owned by the parent.** The consumer passes a pre-fetched
 *   `devices: Device[]` and (optionally) an `infiniteScroll` config. This is
 *   because consumers fetch from different backends, GraphQL `devices` query
 *   (TestScriptModal, ScheduleAssignDevicesView), Tactical RMM REST
 *   (RunScriptView), Fleet MDM (monitoring queries/policies). A single
 *   internal `useDevices` wouldn't fit all of them.
 *
 * - **Filtering is client-side.** Column filter funnels (status/customer) and
 *   tag chips operate on the `devices` array via `Array.filter`. Filter
 *   options shown in the dropdowns are derived from the same array (no extra
 *   network call). Trade-off: if the parent passes a partial page, the
 *   filters see only that page, not the full dataset on the server.
 *
 * - **Pagination is parent-driven via `infiniteScroll`.** The component just
 *   renders `DataTable.InfiniteFooter` and calls `onLoadMore`. The consumer
 *   owns the fetching strategy. In practice all current consumers fetch the
 *   full list (≤100 devices) and don't pass `infiniteScroll` at all.
 *
 * For a server-driven listing with URL state, GraphQL pagination and filter
 * counts coming from the backend, use `DevicesPanel` instead.
 *
 * Two opt-in modes change the picture above:
 *
 * - **`server`** hands search, filtering, paging and the bulk actions to the
 *   parent's backend, see {@link DeviceSelectorServer}.
 * - **`selectionMode` + `criteriaContent`** swap the picker for the rule editor
 *   of "Select Devices by Criteria": `criteriaContent` replaces the card
 *   entirely, the search toolbar and row actions go away, and the table becomes
 *   a live preview of what the rule matches.
 */
export function DeviceSelector<T extends DeviceRow = DeviceRow>({
  devices,
  loading,
  selectedIds: selectedIdsProp,
  onSelectionChange: onSelectionChangeProp,
  getDeviceKey: getDeviceKeyProp,
  infiniteScroll,
  disabled = false,
  showSelectionModeRadio = true,
  headerContent,
  addAllBehavior = 'merge',
  singleSelect = false,
  isDeviceDisabled,
  hideColumns,
  totalCount,
  server,
  selectionMode,
  onSelectionModeChange,
  criteriaContent,
}: DeviceSelectorProps<T>) {
  const selectedIds = (selectedIdsProp ?? EMPTY_SET) as Set<string>;
  const onSelectionChange = onSelectionChangeProp ?? NOOP;
  const getDeviceKey = getDeviceKeyProp ?? DEFAULT_GET_DEVICE_KEY;
  // Criteria mode replaces the whole picker, card, tabs and search row, with
  // the rule editor over a read-only preview of what that rule resolves to.
  const isCriteria = selectionMode === 'criteria';
  // Called unconditionally (hooks rule); in server mode its results are simply
  // not the ones used, the parent's query already answered those questions.
  const client = useDeviceSelector({ devices, selectedIds, getDeviceKey });

  const searchTerm = server ? server.search : client.searchTerm;
  const setSearchTerm = server ? server.onSearchChange : client.setSearchTerm;
  const activeSubTab = server ? server.activeTab : client.activeSubTab;
  const handleTabChange = useMemo(
    () => (server ? (tabId: string) => server.onTabChange(tabId as SubTab) : client.handleTabChange),
    [server, client.handleTabChange],
  );

  // Read latest selectedIds via ref so toggleDevice can stay reference-stable.
  // The DataTable rows are React.memo'd; rows that don't re-render keep an old
  // toggleDevice closure, and a stale closure that captured an outdated
  // selectedIds would corrupt the set on the next click.
  const selectedIdsRef = useRef(selectedIds);
  // Latest-value refs, written after the commit rather than during render:
  // a render-phase ref write is what `react-hooks/refs` forbids, and every
  // reader below runs in an effect, a timer or an event handler.
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  });

  const [clientColumnFilters, setClientColumnFilters] = useState<ColumnFiltersState>([]);
  const [clientTags, setClientTags] = useState<string[]>([]);

  const columnFilters = server ? server.narrowing.columnFilters : clientColumnFilters;
  const selectedTags = server ? server.narrowing.tags : clientTags;

  const setColumnFilters = useCallback(
    (next: ColumnFiltersState) => {
      if (server) server.onNarrowingChange({ columnFilters: next, tags: server.narrowing.tags });
      else setClientColumnFilters(next);
    },
    [server],
  );

  // TanStack hands either a value or an updater fn; resolve it against what is
  // on screen before it reaches the (possibly lifted) setter above.
  const handleTableColumnFiltersChange = useCallback<OnChangeFn<ColumnFiltersState>>(
    updaterOrValue => {
      setColumnFilters(typeof updaterOrValue === 'function' ? updaterOrValue(columnFilters) : updaterOrValue);
    },
    [columnFilters, setColumnFilters],
  );

  const setSelectedTags = useCallback(
    (next: string[]) => {
      if (server) server.onNarrowingChange({ columnFilters: server.narrowing.columnFilters, tags: next });
      else setClientTags(next);
    },
    [server],
  );

  const clientToggleDevice = useCallback(
    (device: T) => {
      if (disabled) return;
      if (isDeviceDisabled?.(device)) return;
      const key = getDeviceKey(device);
      if (key === undefined) return;

      const current = selectedIdsRef.current;
      if (singleSelect) {
        onSelectionChange(current.has(key) ? new Set() : new Set([key]));
        return;
      }

      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      onSelectionChange(next);
    },
    [disabled, isDeviceDisabled, getDeviceKey, onSelectionChange, singleSelect],
  );

  // In server mode the Selected tab can only ever remove. The Available tab
  // holds the whole candidate set, assigned devices included, marked as such by
  // the backend, so there the row does flip: a marked row removes, an unmarked
  // one adds. Read through the ref for the same reason `clientToggleDevice`
  // does: memoized rows keep the closure they were rendered with.
  const toggleDevice = useCallback(
    (device: T) => {
      if (!server) {
        clientToggleDevice(device);
        return;
      }
      if (disabled) return;
      if (isDeviceDisabled?.(device)) return;
      if (server.activeTab === 'selected') {
        server.onRemove(device);
        return;
      }
      const key = getDeviceKey(device);
      if (key !== undefined && selectedIdsRef.current.has(key)) server.onRemove(device);
      else server.onAdd(device);
    },
    [server, clientToggleDevice, disabled, isDeviceDisabled, getDeviceKey],
  );

  const addAllDevices = useCallback(() => {
    if (disabled) return;
    if (server) {
      server.onAddAll();
      return;
    }
    const base = addAllBehavior === 'replace' ? new Set<string>() : new Set(selectedIds);
    for (const d of client.filteredDevices) {
      if (isDeviceDisabled?.(d)) continue;
      const key = getDeviceKey(d);
      if (key !== undefined) {
        base.add(key);
      }
    }
    onSelectionChange(base);
  }, [
    disabled,
    server,
    isDeviceDisabled,
    addAllBehavior,
    selectedIds,
    client.filteredDevices,
    getDeviceKey,
    onSelectionChange,
  ]);

  const removeAllSelected = useCallback(() => {
    if (disabled) return;
    if (server) {
      server.onRemoveAll();
      return;
    }
    onSelectionChange(new Set());
  }, [disabled, server, onSelectionChange]);

  // Tag chips in the search bar take "key:value" form (e.g. "env:prod").
  // Plain text chips are kept visually but don't filter (matches DevicesPanel behavior).
  const selectedTagValues = useMemo(
    () =>
      selectedTags.flatMap(t => {
        const i = t.indexOf(':');
        return i > 0 ? [t.substring(i + 1)] : [];
      }),
    [selectedTags],
  );

  // Apply column filters + tag filters client-side on top of the search/tab-filtered list.
  // singleSelect mode skips the tab split and shows all matching devices.
  // In server mode there is nothing to apply: `devices` is already the answer
  // to this tab, this search and these filters.
  // Criteria mode is the same deal as server mode: `devices` is already the
  // answer, here, the set the rule resolves to.
  const passThrough = !!server || isCriteria;
  const baseDevices = passThrough ? devices : singleSelect ? client.filteredDevices : client.displayDevices;
  const devicesForTable = useMemo(() => {
    if (passThrough || (columnFilters.length === 0 && selectedTagValues.length === 0)) return baseDevices;
    return baseDevices.filter(d => {
      for (const f of columnFilters) {
        const values = f.value as string[];
        if (!values || values.length === 0) continue;
        const cell =
          f.id === 'status'
            ? d.status
            : f.id === 'os'
              ? d.osType
              : f.id === 'organization'
                ? // Same key the option was built from, id first, name only for
                  // rows that have no id.
                  (d.organizationId ?? d.organization)
                : undefined;
        if (cell === undefined || !values.includes(cell)) return false;
      }
      if (selectedTagValues.length > 0) {
        const hasMatchingTag = (d.tags ?? []).some(tag => tag.values.some(v => selectedTagValues.includes(v)));
        if (!hasMatchingTag) return false;
      }
      return true;
    });
  }, [passThrough, baseDevices, columnFilters, selectedTagValues]);

  // Client-side `DeviceFilters`-shaped object, built from the prop list so
  // `useTagFilterModal` and `getDeviceFilterColumns` can drive the FilterModal
  // without a network round-trip.
  const clientDeviceFilters = useMemo<DeviceFilters>(() => {
    const statusCounts = new Map<string, number>();
    const osCounts = new Map<string, number>();
    const orgCounts = new Map<string, { label: string; count: number }>();
    const tagSeen = new Map<string, Map<string, number>>();

    for (const d of devices) {
      if (d.status) statusCounts.set(d.status, (statusCounts.get(d.status) ?? 0) + 1);
      if (d.osType) osCounts.set(d.osType, (osCounts.get(d.osType) ?? 0) + 1);
      // Keyed by id, labelled by name, the mobile FilterModal writes the VALUE
      // into the same `organization` column filter the funnels above do.
      const orgKey = d.organizationId ?? d.organization;
      if (orgKey) {
        const existing = orgCounts.get(orgKey);
        orgCounts.set(orgKey, { label: d.organization ?? orgKey, count: (existing?.count ?? 0) + 1 });
      }
      for (const tag of d.tags ?? []) {
        const vc = tagSeen.get(tag.key) ?? new Map<string, number>();
        tagSeen.set(tag.key, vc);
        for (const v of tag.values) vc.set(v, (vc.get(v) ?? 0) + 1);
      }
    }

    const tagKeys: Array<{ key: string; value: string; count: number }> = [];
    for (const [key, vc] of tagSeen) {
      for (const [value, count] of vc) {
        tagKeys.push({ key, value, count });
      }
    }

    return {
      statuses: Array.from(statusCounts, ([value, count]) => ({ value, count })),
      deviceTypes: [],
      osTypes: Array.from(osCounts, ([value, count]) => ({ value, count })),
      organizationIds: Array.from(orgCounts, ([value, { label, count }]) => ({ value, label, count })),
      tagKeys,
      filteredCount: devices.length,
    };
  }, [devices]);

  // Counting the rows on screen only describes the page the client happens to
  // hold; when the server is paging, it supplies the real facets instead.
  const deviceFilters = server?.filterOptions ?? clientDeviceFilters;

  // Counts ride along only when the facets are the server's. The client-side
  // ones describe the page in hand, which is not what a count claims to answer.
  const serverFaceted = Boolean(server?.filterOptions);
  const filterColumns = useMemo(() => {
    const columns = getDeviceFilterColumns(deviceFilters);
    if (serverFaceted) return columns;
    return columns.map(column => ({
      ...column,
      filterOptions: column.filterOptions?.map(({ count: _count, ...option }) => option),
    }));
  }, [deviceFilters, serverFaceted]);

  // The column funnels read `deviceFilters`, the SERVER's facets whenever the
  // consumer is server-narrowed, rather than the rows in hand.
  //
  // They used to be derived from the `devices` prop, and in server mode that is
  // the narrowed page: picking one customer left the funnel holding only that
  // customer, so the second one became unpickable and the filter closed behind
  // the first click. In client mode nothing changes, `deviceFilters` IS the
  // row-derived object there, and those rows are the unfiltered prop list.
  //
  // Same source as the mobile FilterModal below, so the two can no longer offer
  // different things.
  const statusFilterOptions = useMemo(() => {
    const options = filterColumns.find(column => column.key === 'status')?.filterOptions ?? [];
    // ARCHIVED last: it is a state a device leaves the fleet in, not one anybody
    // filters by first.
    return [...options].sort((a, b) => {
      if (a.value === DEVICE_STATUS.ARCHIVED) return 1;
      if (b.value === DEVICE_STATUS.ARCHIVED) return -1;
      return 0;
    });
  }, [filterColumns]);

  // The funnel's VALUE is the customer id, that is what a server-narrowed
  // consumer puts into `organizationIds`, and a name sent there matches nothing.
  // `getDeviceFilterColumns` keys these by id and labels them by name, and the
  // client-side matcher below compares the same id, so the two stay in step.
  const orgFilterOptions = useMemo(
    () => filterColumns.find(column => column.key === 'organization')?.filterOptions ?? [],
    [filterColumns],
  );

  // Adapter: useTagFilterModal expects a single `setParams({ statuses, osTypes, organizationIds, tags })`
  // call. We split it back into our local state.
  const handleSetParams = useCallback(
    (params: Record<string, string[]>) => {
      setColumnFilters([
        ...(params.statuses?.length ? [{ id: 'status', value: params.statuses }] : []),
        ...(params.osTypes?.length ? [{ id: 'os', value: params.osTypes }] : []),
        ...(params.organizationIds?.length ? [{ id: 'organization', value: params.organizationIds }] : []),
      ]);
      setSelectedTags(params.tags ?? []);
    },
    [setColumnFilters, setSelectedTags],
  );

  const {
    isOpen: tagsModalOpen,
    open: openTagsModal,
    close: closeTagsModal,
    isMdUp,
    filterGroups,
    tagFilterKeys,
    handleFilterChange: handleModalFilterChange,
    handleTagsChange: handleModalTagsChange,
  } = useTagFilterModal({
    tags: selectedTags,
    deviceFilters,
    columns: filterColumns,
    setParams: handleSetParams,
  });

  const tagOptions = useMemo(() => selectedTags.map(t => ({ label: t, value: t })), [selectedTags]);

  // Map column filters → `{ status, os, organization }` shape that FilterModal expects on mobile.
  const tableFilters = useMemo(
    () => ({
      status: (columnFilters.find(f => f.id === 'status')?.value as string[]) ?? [],
      os: (columnFilters.find(f => f.id === 'os')?.value as string[]) ?? [],
      organization: (columnFilters.find(f => f.id === 'organization')?.value as string[]) ?? [],
    }),
    [columnFilters],
  );

  const handleTagRemove = useCallback(
    (value: string) => {
      setSelectedTags(selectedTags.filter(t => t !== value));
    },
    [selectedTags, setSelectedTags],
  );

  const handleClearAll = useCallback(() => {
    setSearchTerm('');
    setSelectedTags([]);
  }, [setSearchTerm, setSelectedTags]);

  const handleTagSubmit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      if (!selectedTags.includes(trimmed)) setSelectedTags([...selectedTags, trimmed]);
      setSearchTerm('');
    },
    [selectedTags, setSelectedTags, setSearchTerm],
  );

  const columns = useMemo<ColumnDef<T>[]>(
    () => [
      {
        id: 'device',
        accessorKey: 'device',
        header: 'DEVICE',
        cell: ({ row }: { row: Row<T> }) => {
          const device = row.original;
          const lastSeen = device.last_seen || device.lastSeen;
          return (
            <div className="flex h-20 items-center gap-3">
              <DeviceTypeTile type={device.type} />
              <div className="flex min-w-0 flex-col">
                <TruncateText>{getDeviceName(device)}</TruncateText>
                <TruncateText variant="h6" tone="secondary">
                  {formatLastOnline(lastSeen)}
                </TruncateText>
              </div>
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: 'organization',
        accessorKey: 'organization',
        header: 'CUSTOMER',
        cell: ({ row }: { row: Row<T> }) => <CustomerCell device={row.original} />,
        enableSorting: false,
        meta: {
          width: 'w-[320px]',
          hideAt: 'lg',
          filter: { options: orgFilterOptions, placement: 'bottom-end' },
        },
      },
      {
        id: 'os',
        accessorKey: 'os',
        header: 'OS',
        cell: ({ row }: { row: Row<T> }) => (
          <OSTypeBadge osType={row.original.osType} iconSize="w-4 h-4 content-md:w-6 content-md:h-6" />
        ),
        enableSorting: false,
        meta: {
          width: 'w-[200px] content-md:w-1/6',
          hideAt: 'md',
        },
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'STATUS',
        cell: ({ row }: { row: Row<T> }) => {
          const config = getDeviceStatusConfig(row.original.status);
          return <Tag label={config.label} variant={config.variant} className="w-min" />;
        },
        enableSorting: false,
        meta: {
          width: 'w-auto shrink-0 content-md:w-[160px]',
          filter: { options: statusFilterOptions },
        },
      },
      {
        id: 'actions',
        cell: ({ row }: { row: Row<T> }) => {
          const device = row.original;
          const disabledReason = isDeviceDisabled?.(device);

          if (disabledReason) {
            return (
              <div data-no-row-click className="pointer-events-auto flex w-full items-center justify-end gap-2">
                <span className="whitespace-pre-line text-right text-ods-text-secondary text-h6 content-max-md:hidden">
                  {disabledReason}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  leftIcon={<PlusCircleIcon size={24} />}
                  className="shrink-0 text-ods-text-secondary"
                  disabled
                />
              </div>
            );
          }

          const key = getDeviceKey(device);
          if (key === undefined) return null;
          // Server mode fills `selectedIds` from the connection's own
          // per-row flag, so "already in?" is answered by the backend rather
          // than by whichever page the client happens to hold.
          const isSelected = selectedIds.has(key);

          if (activeSubTab === 'selected') {
            return (
              <div data-no-row-click className="pointer-events-auto flex w-full items-center justify-end">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => toggleDevice(device)}
                  leftIcon={<TrashIcon size={24} />}
                  className="text-ods-error hover:opacity-80"
                  disabled={disabled}
                />
              </div>
            );
          }

          return (
            <div data-no-row-click className="pointer-events-auto flex w-full items-center justify-end">
              <Button
                variant="outline"
                size="icon"
                onClick={() => toggleDevice(device)}
                leftIcon={isSelected ? <CheckCircleIcon size={24} /> : <PlusCircleIcon size={24} />}
                // Selected is a STATE, not an affordance: the yellow fill already
                // says "this one is in", so it holds still under the cursor. The
                // hover repeats on both bg and border because `variant="outline"`
                // ships its own `hover:bg-ods-bg-hover` / `hover:border-ods-border-hover`
                //, restating them at the same value is what neutralizes them.
                className={
                  isSelected
                    ? 'border-ods-accent bg-ods-open-yellow-secondary text-ods-accent hover:border-ods-accent hover:bg-ods-open-yellow-secondary'
                    : 'text-ods-text-secondary hover:text-ods-text-primary'
                }
                disabled={disabled}
              />
            </div>
          );
        },
        enableSorting: false,
        meta: { width: 'w-12 content-md:w-auto content-md:min-w-[130px] shrink-0 flex-none', align: 'right' },
      },
    ],
    [
      statusFilterOptions,
      orgFilterOptions,
      isDeviceDisabled,
      getDeviceKey,
      selectedIds,
      activeSubTab,
      toggleDevice,
      disabled,
    ],
  );

  const visibleColumns = useMemo(() => {
    // Nothing on a criteria row is actionable, membership follows the rule, so
    // an add/remove button there would promise an edit the mode cannot make.
    const hidden = new Set([...(hideColumns ?? []), ...(isCriteria ? ['actions'] : [])]);
    if (hidden.size === 0) return columns;
    return columns.filter(c => !c.id || !hidden.has(c.id));
  }, [columns, hideColumns, isCriteria]);

  const table = useDataTable<T>({
    data: devicesForTable,
    columns: visibleColumns,
    getRowId: row => String(getDeviceKey(row) ?? row.id),
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange: handleTableColumnFiltersChange,
  });

  const selectedCount = server ? server.selectedCount : selectedIds.size;

  // Per-row className whose value differs by selection state. DataTableRow is
  // React.memo'd on `className`, so only rows whose selection actually flipped
  // re-render, the rest keep their cached cells (with stable toggleDevice).
  const rowClassName = useCallback(
    (device: T): string => {
      const key = getDeviceKey(device);
      if (key === undefined) return '';
      return selectedIds.has(key) ? 'is-selected' : '';
    },
    [selectedIds, getDeviceKey],
  );

  const assignTabs: TabItem[] = useMemo(
    () => [
      {
        id: 'available',
        label: 'Available Devices',
        icon: MonitorIcon,
        // The table is rendered outside TabContent now, these `component` slots
        // exist only because TabNavigation/TabItem require them. Render nothing.
        component: () => null,
      },
      {
        id: 'selected',
        // Server mode counts the whole assignment, not the page in hand.
        label: singleSelect ? `Selected Device (${selectedCount})` : `Selected Devices (${selectedCount})`,
        icon: CheckCircleIcon,
        component: () => null,
      },
    ],
    [selectedCount, singleSelect],
  );

  const availableInfiniteScroll = activeSubTab === 'available' ? infiniteScroll : undefined;

  // Column headers over nothing are just noise, drop them when the list is
  // empty. Except when the emptiness is the RESULT of narrowing (search, tag
  // chips, column funnels): the funnels live in that header, so tearing it down
  // would strip the only way to undo the filter that emptied the table. While
  // loading, the skeleton rows are the content the header belongs to.
  // The design (460:71435) puts the bulk action where a table normally shows its
  // row count, the right end of the column header, instead of on a line of its
  // own above the table. Null in single-select mode, and on the Selected tab
  // until there is something to remove; the row count takes the slot back then.
  const bulkAction =
    singleSelect || isCriteria ? null : activeSubTab === 'available' ? (
      <button
        type="button"
        onClick={addAllDevices}
        disabled={disabled}
        className="cursor-pointer border-0 bg-transparent text-ods-accent underline text-h6 hover:text-ods-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        Add All Devices
      </button>
    ) : selectedCount > 0 ? (
      <button
        type="button"
        onClick={removeAllSelected}
        disabled={disabled}
        className="cursor-pointer border-0 bg-transparent text-ods-error underline text-h6 hover:text-ods-error-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        Remove {server ? (server.totalCount ?? devicesForTable.length) : selectedIds.size} Devices
      </button>
    ) : null;

  const hasActiveFilter = columnFilters.length > 0 || selectedTags.length > 0 || searchTerm.trim().length > 0;
  // In criteria mode the header's row count is the readout of the rule ("42
  // devices"), so it stays even at zero, that IS the answer the user is after.
  const showHeader = isCriteria || loading || devicesForTable.length > 0 || hasActiveFilter;

  const deviceTable = (
    <DataTable table={table}>
      {showHeader && (
        <DataTable.Header
          rightSlot={
            bulkAction ?? <DataTable.RowCount itemName="device" totalCount={totalCount ?? server?.totalCount} />
          }
        />
      )}
      <DataTable.Body
        loading={loading}
        skeletonRows={8}
        emptyMessage={
          isCriteria
            ? 'No devices match these criteria'
            : activeSubTab === 'selected'
              ? 'No devices selected'
              : 'No devices found'
        }
        rowClassName={rowClassName}
      />
      {availableInfiniteScroll && (
        <DataTable.InfiniteFooter
          hasNextPage={availableInfiniteScroll.hasNextPage}
          isFetchingNextPage={availableInfiniteScroll.isFetchingNextPage}
          onLoadMore={availableInfiniteScroll.onLoadMore}
          skeletonRows={availableInfiniteScroll.skeletonRows}
        />
      )}
    </DataTable>
  );

  return (
    // The page-level stack (info bar → mode picker → the picker card) uses
    // `--spacing-system-l`, the token every other stacked page surface in the app
    // separates its blocks with (16px mobile / 24px desktop).
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      {headerContent}

      {showSelectionModeRadio && (
        <DeviceSelectionModeRadio value={selectionMode} onChange={onSelectionModeChange} disabled={disabled} />
      )}

      {/* Criteria mode (design 460:85294) has no card at all: the rule's fields
          and the table it previews sit straight on the page, in the same 24px
          stack as everything above them. There is nothing to frame, no tab
          strip to seat, and no search row to inset with it. */}
      {isCriteria ? (
        <>
          {criteriaContent}
          {deviceTable}
        </>
      ) : (
        /* Design 460:71435 frames the picker as ONE bordered card: the tab strip
           sits flush against the top edge with its own underline doubling as the
           divider, and the search row and table are inset below it.
           Deliberately NOT `overflow-clip` (which the Figma export puts here to
           round the tab strip's corners): the column-filter dropdowns are
           absolutely positioned INSIDE this box rather than portaled, so clipping
           it would cut them off whenever the table is short. The tab strip clips
           its own corners instead: it is the only child that reaches the radius. */
        <div className="flex flex-col rounded-[6px] border border-ods-border bg-ods-bg">
          {!singleSelect && (
            <TabNavigation
              tabs={assignTabs}
              activeTab={activeSubTab}
              onTabChange={handleTabChange}
              className="overflow-clip rounded-t-[6px]"
            />
          )}

          <div className="flex flex-col gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)]">
            <DevicesFilterToolbar
              sticky={false}
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              tags={tagOptions}
              onTagRemove={handleTagRemove}
              onClearAll={handleClearAll}
              onSubmit={handleTagSubmit}
              onOpenFilterModal={openTagsModal}
              isFilterModalOpen={tagsModalOpen}
              onCloseFilterModal={closeTagsModal}
              filterGroups={filterGroups}
              onFilterChange={handleModalFilterChange}
              currentFilters={isMdUp === false ? tableFilters : undefined}
              tagFilterKeys={tagFilterKeys}
              selectedTags={selectedTags}
              onTagsChange={handleModalTagsChange}
            />

            {deviceTable}
          </div>
        </div>
      )}
    </div>
  );
}

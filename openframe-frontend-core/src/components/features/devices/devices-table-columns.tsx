'use client';

import type React from 'react';
import { type MouseEvent, type ReactNode, useMemo, useState } from 'react';
import { useChatRuntime } from '../../../contexts/chat-runtime-context';
import { cn } from '../../../utils/cn';
import { formatDate, formatTime } from '../../../utils/format-date';
import { executeNewTabNavigation } from '../../chat/utils/execute-navigation';
import { ArrowRightUpIcon, MonitorIcon } from '../../icons-v2-generated';
import { MediaSkeleton, TextLineSkeleton } from '../../loading/unified-skeleton';
import {
  Button,
  type ColumnDef,
  type ColumnFiltersState,
  DataTable,
  type DataTableFilterSection,
  type DataTableLayout,
  type DataTableSettings,
  EntityImage,
  GRID_MIN_WIDTH,
  type NoDataProps,
  type OnChangeFn,
  GRID_ACTION_COLUMN_SIZE,
  type Row,
  type RowSelectionState,
  selectionColumn,
  Tag,
  TruncateText,
  useDataTable,
  useLoadingScope,
} from '../../ui';
import { DATA_TABLE_SKELETON_ROWS } from '../../ui/data-table/utils';
import { OSTypeBadge } from '../os-type-badge';
import { DeviceConnectivityIcon } from './device-connectivity-icon';
import { directorySourceLabel, directoryUserLines, directoryUserLinkLabel } from './device-directory';
import { DeviceLifecycleTag } from './device-lifecycle-tag';
import { getDeviceName } from './device-name';
import { getDeviceConnectivityConfig, getDeviceLifecycleConfig, getDeviceStatusConfig } from './device-status';
import { type DeviceStatusDisplay, useDeviceStatusDisplay } from './device-status-display';
import {
  DEFAULT_VISIBLE_STATUSES,
  DEVICE_CONNECTIVITY_FILTER_SECTION,
  DEVICE_CONNECTIVITY_VALUES,
  DEVICE_STATUS,
  joinStatusFilterValue,
  mergeStatusFacets,
} from './device-statuses';
import { renderDeviceTypeIcon } from './device-type-icon';
import { DeviceTypeTile } from './device-type-tile';
import { DeviceUnreadIndicator } from './device-unread-indicator';
import { useDeviceImageUrl, useDevicesViewConfig } from './devices-view-config';
import type { DeviceFilters, DeviceRow } from './types';

/** Date then time in the viewer's locale; the empty mark for an instant that does not parse. */
function formatDateTime(input: string): string {
  const date = formatDate(input);
  return date === '—' ? date : `${date} ${formatTime(input)}`;
}

/** Filter options by id, first one wins: the backend can repeat a customer. */
function uniqueById<T extends { id: string }>(options: T[]): T[] {
  const seen = new Map<string, T>();
  for (const option of options) {
    if (!seen.has(option.id)) seen.set(option.id, option);
  }
  return Array.from(seen.values());
}

/**
 * The row-actions column, declared here beside every other device column so the
 * loaded table and its loading state can't disagree about the column set.
 *
 * `renderRowActions` is optional because a loading table has no rows to act on
 *, omit it and the column keeps its width and alignment while drawing nothing,
 * which is exactly what the skeleton needs. Leaving the column out instead
 * shifted every other column, since it takes real width from them.
 */
export function getDeviceActionsColumn<T extends DeviceRow = DeviceRow>(
  renderRowActions?: (device: T) => React.ReactNode,
): ColumnDef<T> {
  return {
    id: 'actions',
    cell: renderRowActions
      ? ({ row }: { row: Row<T> }) => (
          <div data-no-row-click className="pointer-events-auto flex items-center justify-end gap-2">
            {renderRowActions(row.original)}
          </div>
        )
      : () => null,
    enableSorting: false,
    size: GRID_ACTION_COLUMN_SIZE,
    meta: { width: 'w-12 shrink-0 flex-none', align: 'right', gridKind: 'action' },
  };
}

/** Opens the device's page in a new tab. A button, because the row is itself a link and a link cannot hold a link. */
function OpenDeviceButton({ device, grid = false }: { device: DeviceRow; grid?: boolean }) {
  const { getDeviceHref } = useDevicesViewConfig();
  const runtime = useChatRuntime();
  // The button is static chrome: drawn real while the row is read, and inert.
  const loading = useLoadingScope();
  const href = loading ? undefined : getDeviceHref?.(device);
  const open = (event: MouseEvent) => {
    event.preventDefault();
    if (href) executeNewTabNavigation({ runtime, href });
  };
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <Button
        onClick={open}
        // In the grid the action is a bare 40px icon button: the cell is its frame.
        variant={grid ? 'transparent' : 'outline'}
        size="icon"
        leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
        aria-label="Open in new tab"
        className={grid ? 'size-10 border-0 md:size-10' : 'bg-ods-card'}
        disabled={loading}
      />
    </div>
  );
}

export function getDeviceOpenColumn<T extends DeviceRow = DeviceRow>(): ColumnDef<T> {
  return {
    id: 'open',
    cell: ({ row }: { row: Row<T> }) => <OpenDeviceButton device={row.original} />,
    enableSorting: false,
    size: GRID_ACTION_COLUMN_SIZE,
    meta: {
      width: 'w-12 shrink-0 flex-none',
      hideAt: 'md',
      align: 'right',
      gridKind: 'action',
      gridCell: ({ row }) => <OpenDeviceButton device={row.original} grid />,
    },
  };
}

export interface DevicesTableBodyProps<T extends DeviceRow = DeviceRow> {
  devices: T[];
  isLoading?: boolean;
  /** The loading state announces itself ("Loading results"). `false` inside another loading region. Default `true`. */
  loadingRegion?: boolean;
  /**
   * The empty state, as the design's `data-placeholder`: icon over a title over
   * a description. Wins over `emptyMessage` when both are given.
   */
  emptyState?: NoDataProps;
  /** @deprecated Single-line variant of {@link emptyState}, pass `emptyState` instead. */
  emptyMessage?: string;
  skeletonRows?: number;
  stickyHeaderOffset?: string;
  footerSlot?: ReactNode;
  deviceFilters?: DeviceFilters | null;
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;
  /** Optional extra column inserted before the open-in-new-tab column (e.g. row actions on the dedicated page). */
  actionsColumn?: ColumnDef<T>;
  /** Column ids to drop from the base table columns (e.g. ['organization'] when scoped to a single org). */
  hideColumns?: string[];
  /** Adds the USER and SOURCES columns, for a host whose tenant has directories. Default: neither. */
  directoryColumns?: boolean;
  /** Column ids whose header filter is dropped while the column stays visible (e.g. ['status'] on the archive page). */
  disableColumnFilters?: string[];
  /** The facet query is still in flight, see `getDeviceTableColumns`. */
  filtersPending?: boolean;
  /** Server-side total (for paginated lists). Falls back to loaded-row count when omitted. */
  totalCount?: number;
  /**
   * Render the column header. Default true.
   *
   * Pass `false` to drop it over a genuinely empty list, column labels above
   * nothing are noise, and the empty message reads better without a row of
   * headings it does not explain. Keep it `true` while loading (the skeleton
   * rows are the content it belongs to) and whenever the emptiness is the RESULT
   * of narrowing: the column funnels live in this header, so removing it would
   * strip the only way to undo the filter that emptied the table.
   */
  showHeader?: boolean;
  /**
   * The table's layout. `grid`: 48px one-line rows in one bordered block at every width, the action columns pinned
   * right, the device column pinned left on a desktop with at least 720px of content (it scrolls with the rest on a
   * tablet, a phone and in a narrower content column). Default `cards`.
   */
  layout?: DataTableLayout;
  /**
   * Grid layout: the table's height. `'fill'` takes the height the page leaves under the table's top, so the table
   * scrolls inside itself (sticky header, a gradient under it and above the bottom edge) and the page does not.
   * Omitted, the page scrolls.
   */
  tableMaxHeight?: number | string;
  /** Grid layout: the table's settings (the gear's menu of columns, the saved column layout). See `DataTable`. */
  tableSettings?: DataTableSettings;
  /**
   * Grid layout: draw the checkbox column first (the design's `table/utility-cell`, type checkbox). Off by default:
   * the devices list has nothing to do with a selection yet, and the design draws the column only on a table that
   * does. Card rows never draw it.
   */
  selectable?: boolean;
  /**
   * The selected rows, by row id, of a `selectable` grid table. Omit both to let the table keep the selection itself.
   */
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
}

/** One page of rows still being read: an id each, and nothing a cell can show (every cell draws its loading form). */
function deviceLoadingRows<T extends DeviceRow>(count: number): T[] {
  // A row the table can key: the fields a device row requires, empty. The cells read nothing else.
  return Array.from({ length: count }, (_, index) => ({ id: `loading-${index}`, machineId: '', status: '' }) as T);
}

export function DevicesTableBody<T extends DeviceRow = DeviceRow>({
  devices,
  isLoading,
  loadingRegion,
  emptyState,
  emptyMessage = 'No devices found.',
  skeletonRows,
  stickyHeaderOffset,
  footerSlot,
  deviceFilters,
  columnFilters,
  onColumnFiltersChange,
  actionsColumn,
  hideColumns,
  directoryColumns = false,
  disableColumnFilters,
  filtersPending,
  totalCount,
  showHeader = true,
  layout = 'cards',
  tableMaxHeight,
  tableSettings,
  selectable: selectableGiven = false,
  rowSelection: rowSelectionGiven,
  onRowSelectionChange,
}: DevicesTableBodyProps<T>) {
  // The grid's checkbox column, when the host asks for it: the selection is the host's when it passes one, the
  // table's own otherwise.
  const [ownRowSelection, setOwnRowSelection] = useState<RowSelectionState>({});
  const rowSelection = rowSelectionGiven ?? ownRowSelection;
  const selectable = selectableGiven && layout === 'grid';
  const { getDeviceHref } = useDevicesViewConfig();
  const statusDisplay = useDeviceStatusDisplay();
  const columns = useMemo<ColumnDef<T>[]>(() => {
    const hidden = new Set(hideColumns ?? []);
    const unfiltered = new Set(disableColumnFilters ?? []);
    const base = getDeviceTableColumns<T>(deviceFilters ?? null, filtersPending, {
      directoryColumns,
      // Without the customer column there is room for the sources from where the customer's column would have started.
      roomyDirectory: hidden.has('organization'),
      statusDisplay,
    })
      .filter(c => !c.id || !hidden.has(c.id))
      .map(c => (c.id && unfiltered.has(c.id) ? { ...c, meta: { ...c.meta, filter: undefined } } : c));
    const open = getDeviceOpenColumn<T>();
    const data = actionsColumn ? [...base, actionsColumn, open] : [...base, open];
    // The checkbox column is the grid table's first column.
    return selectable ? [selectionColumn<T>(), ...data] : data;
  }, [
    deviceFilters,
    filtersPending,
    actionsColumn,
    hideColumns,
    directoryColumns,
    disableColumnFilters,
    selectable,
    statusDisplay,
  ]);

  // While loading the table holds one page of empty rows, drawn with the real cells: every part of a row draws its
  // own loading form (`DataTable.Body`'s `loadingCells`), so a loading row is the loaded row's own layout.
  const loadingRows = useMemo(
    () => (isLoading ? deviceLoadingRows<T>(skeletonRows ?? DATA_TABLE_SKELETON_ROWS) : null),
    [isLoading, skeletonRows],
  );

  const table = useDataTable<T>({
    data: loadingRows ?? devices,
    columns,
    // `machineId` is EMPTY (not absent) while the agent is not connected: those rows key on their id.
    getRowId: row => String(row.machineId || row.id),
    enableSorting: false,
    // A row still being read cannot be selected.
    enableRowSelection: selectable && !loadingRows,
    state: { ...(columnFilters !== undefined ? { columnFilters } : {}), rowSelection },
    onColumnFiltersChange,
    onRowSelectionChange: onRowSelectionChange ?? setOwnRowSelection,
  });

  return (
    <DataTable
      table={table}
      layout={layout}
      maxHeight={layout === 'grid' ? tableMaxHeight : undefined}
      settings={layout === 'grid' ? tableSettings : undefined}
    >
      {/* The grid's results count sits above the table; the card header carries its own (`rightSlot`). */}
      {showHeader && layout === 'grid' && (
        <DataTable.Meta>
          <DataTable.RowCount itemName="device" totalCount={totalCount} loading={isLoading} />
        </DataTable.Meta>
      )}
      {showHeader && (
        <DataTable.Header
          stickyHeader={!!stickyHeaderOffset}
          stickyHeaderOffset={stickyHeaderOffset}
          rightSlot={<DataTable.RowCount itemName="device" totalCount={totalCount} loading={isLoading} />}
          loading={isLoading}
        />
      )}
      <DataTable.Body
        loading={isLoading}
        loadingCells
        loadingRegion={loadingRegion}
        skeletonRows={skeletonRows}
        emptyState={emptyState}
        emptyMessage={emptyState ? undefined : emptyMessage}
        rowClassName="mb-1"
        rowHref={getDeviceHref}
      />
      {footerSlot}
    </DataTable>
  );
}

function OrganizationCell({ device }: { device: DeviceRow }) {
  const fullImageUrl = useDeviceImageUrl(device.organizationImageUrl, device.organizationImageHash);

  return (
    <div className="flex items-center gap-3">
      <EntityImage src={fullImageUrl} alt={device.organization || 'Customer'} className="size-12 content-md:size-12" />
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <OrganizationName name={device.organization} />
      </div>
    </div>
  );
}

/**
 * The customer's name, clamped to the two lines the row's height holds (an unclamped one spilled into the rows
 * around it); one bar while the row is read, as most names take one line.
 */
function OrganizationName({ name }: { name: string | undefined }) {
  if (useLoadingScope() && !name) return <TextLineSkeleton type="h4" className="w-3/4" />;
  return <TruncateText lines={2}>{name ?? ''}</TruncateText>;
}

/** When the device was last seen, under its status; a bar while the row is read. */
function DeviceLastSeen({ lastSeen }: { lastSeen: string | undefined }) {
  if (useLoadingScope() && !lastSeen) return <TextLineSkeleton type="h6" className="hidden w-24 content-md:block" />;
  return (
    <span className="hidden text-ods-text-secondary text-h6 content-md:flex">
      {lastSeen ? formatDateTime(lastSeen) : 'Never'}
    </span>
  );
}

/** The name over its role, as the USER column reads it (Figma 865:55733); the empty mark when nobody is tied. */
function DirectoryUserCell({ device }: { device: DeviceRow }) {
  const loading = useLoadingScope();
  if (loading && !device.directoryUserLink) {
    return <TextLineSkeleton type="h4" className="w-3/4" />;
  }
  const { name, detail } = directoryUserLines(device);
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <TruncateText>{name}</TruncateText>
      {detail && (
        <TruncateText variant="h6" tone="secondary">
          {detail}
        </TruncateText>
      )}
    </div>
  );
}

/** The directories that know the device, as tags (Figma 187:61663); nothing when none does. */
function DirectorySourcesCell({ sources }: { sources: readonly string[] | undefined }) {
  return (
    <div data-loading-optional className="flex min-w-0 flex-wrap gap-[var(--spacing-system-xxs)]">
      {(sources ?? []).map(source => (
        <Tag key={source} label={directorySourceLabel(source)} variant="grey" />
      ))}
    </div>
  );
}

/* ───────────────────────── grid-layout cells: one 48px line each ───────────────────────── */

const GRID_DEVICE_ICON_CLASS = 'size-5';

/** The table's DEVICE cell: the connectivity icon (the type tile in the legacy display), the name, the unread mark. */
function DeviceNameTableCell({ device }: { device: DeviceRow }) {
  const legacy = useDeviceStatusDisplay() === 'legacy';
  return (
    <div
      className={cn(
        'relative box-border flex h-20 w-full shrink-0 content-stretch items-center justify-start py-0',
        legacy ? 'gap-[var(--spacing-system-mf)]' : 'gap-[var(--spacing-system-xxs)]',
      )}
    >
      {/* The device's icon says whether it is online right now (Figma 3324-6819). */}
      <DeviceConnectivityIcon
        connectivity={device.connectivity}
        lastSeen={device.last_seen ?? device.lastSeen}
        legacyIcon={<DeviceTypeTile type={device.type} />}
      />
      <div className="min-w-0 flex-1">
        <TruncateText>{getDeviceName(device)}</TruncateText>
      </div>
      {/* In the name's cell, not the open column: that one is dropped on a narrow page. */}
      <DeviceUnreadIndicator device={device} />
    </div>
  );
}

/** The legacy display's icon in the grid's name cell: the device's type icon, as before the connectivity icon. */
function DeviceTypeGridIcon({ type }: { type: string | null | undefined }) {
  const loading = useLoadingScope();
  if (loading) return <MediaSkeleton.Icon size="sm" />;
  return (
    renderDeviceTypeIcon(type ?? undefined, GRID_DEVICE_ICON_CLASS) ?? (
      <MonitorIcon className={GRID_DEVICE_ICON_CLASS} />
    )
  );
}

/** The device's connectivity icon (its type icon in the legacy display), its name, and its unread mark at the end. */
function DeviceNameGridCell({ device }: { device: DeviceRow }) {
  const unread = (device.unreadNotificationCount ?? 0) > 0;
  return (
    <DataTable.Cell
      leading={{
        type: 'icon',
        icon: (
          <DeviceConnectivityIcon
            connectivity={device.connectivity}
            lastSeen={device.last_seen ?? device.lastSeen}
            size={20}
            className={GRID_DEVICE_ICON_CLASS}
            legacyIcon={<DeviceTypeGridIcon type={device.type} />}
          />
        ),
      }}
      text={getDeviceName(device)}
      trailing={unread ? <DeviceUnreadIndicator device={device} /> : undefined}
    />
  );
}

/** The status tag with when the device was last seen beside it. */
function DeviceStatusGridCell({ device }: { device: DeviceRow }) {
  const loading = useLoadingScope();
  // While the row is read there is no "last seen" to print: the tag's own skeleton is the cell.
  const lastSeen =
    loading && !device.last_seen ? undefined : device.last_seen ? formatDateTime(device.last_seen) : 'Never';
  return (
    <DataTable.Cell
      tag={<DeviceLifecycleTag status={device.status} connectivity={device.connectivity ?? null} />}
      secondary={lastSeen}
    />
  );
}

/** The customer's logo and name. */
function OrganizationGridCell({ device }: { device: DeviceRow }) {
  const fullImageUrl = useDeviceImageUrl(device.organizationImageUrl, device.organizationImageHash);
  return (
    <DataTable.Cell
      leading={{ type: 'image', src: fullImageUrl, alt: device.organization || 'Customer' }}
      text={device.organization ?? ''}
    />
  );
}

/** The directory user's name with its role beside it; a bar while the row is read. */
function DirectoryUserGridCell({ device }: { device: DeviceRow }) {
  const loading = useLoadingScope();
  if (loading && !device.directoryUserLink) return <DataTable.Cell text="" />;
  const { name, detail } = directoryUserLines(device);
  return <DataTable.Cell text={name} secondary={detail ?? undefined} />;
}

/** The first directory as a tag, the rest behind `+N`; nothing when none knows the device. */
function DirectorySourcesGridCell({ sources }: { sources: readonly string[] | undefined }) {
  const [first, ...rest] = (sources ?? []).map(directorySourceLabel);
  if (first === undefined) return null;
  return <DataTable.Cell tag={<Tag label={first} variant="grey" />} moreTags={rest} />;
}

export interface DeviceFilterColumn {
  key: string;
  label: string;
  filterable?: boolean;
  filterOptions?: DeviceFilterOption[];
  /** Filters in the filter window from `lg` until `xl` too: its column's header has no funnel there. */
  inWindowLgToXl?: boolean;
}

/** A device filter dropdown entry: `meta.filter.options` plus the facet count. */
export interface DeviceFilterOption {
  id: string;
  label: string;
  value: string;
  count?: number;
}

/** The OS, customer and directory options: the same in either status display. */
function buildOtherFilterOptions(deviceFilters: DeviceFilters | null | undefined) {
  const os = (deviceFilters?.osTypes ?? []).map(o => ({ id: o.value, label: o.value, value: o.value, count: o.count }));

  const organization = uniqueById(
    (deviceFilters?.organizationIds ?? []).map(org => ({
      id: org.value,
      label: org.label,
      value: org.value,
      count: org.count,
    })),
  );

  const user = (deviceFilters?.userLinks ?? []).map(link => ({
    id: link.value,
    label: directoryUserLinkLabel(link.value),
    value: link.value,
    count: link.count,
  }));

  const sources = (deviceFilters?.directorySources ?? []).map(source => ({
    id: source.value,
    label: directorySourceLabel(source.value),
    value: source.value,
    count: source.count,
  }));

  return { os, organization, user, sources };
}

/** Status / OS / customer options, shared by the table headers and the grid row. */
function buildDeviceFilterOptions(
  deviceFilters: DeviceFilters | null | undefined,
  statusDisplay: DeviceStatusDisplay,
): {
  status: DeviceFilterOption[];
  connectivity: DeviceFilterOption[];
  os: DeviceFilterOption[];
  organization: DeviceFilterOption[];
  user: DeviceFilterOption[];
  sources: DeviceFilterOption[];
} {
  // Show only DEFAULT_VISIBLE_STATUSES (DELETED and legacy ARCHIVED live on /devices/archive). MANAGED, ONLINE and
  // OFFLINE are one option, "Managed", with their counts summed: the UI value MANAGED stands for all three.
  const status = mergeStatusFacets(deviceFilters?.statuses ?? [])
    .filter(s => (DEFAULT_VISIBLE_STATUSES as readonly string[]).includes(s.value))
    .map(s => ({ id: s.value, label: getDeviceLifecycleConfig(s.value).label, value: s.value, count: s.count }));

  // Online / Offline, in that order, from the connectivity facet (none from a backend without one).
  const connectivityRows = deviceFilters?.connectivity ?? [];
  const connectivity = DEVICE_CONNECTIVITY_VALUES.flatMap(value => {
    const row = connectivityRows.find(r => r.value.toUpperCase() === value);
    return row ? [{ id: value, label: getDeviceConnectivityConfig(value).label, value, count: row.count }] : [];
  });

  // The legacy display (`DeviceStatusDisplay`) has no Connectivity group: ONLINE and OFFLINE are STATUS options again,
  // in place of MANAGED, and still filter on connectivity (`connectivity:ONLINE`, split out where the query is built).
  // A backend with no connectivity facet has nothing to split MANAGED by: MANAGED stays, or managed devices could not
  // be picked at all.
  if (statusDisplay === 'legacy') {
    const legacyStatus = [
      ...connectivity.map(option => {
        const [value] = joinStatusFilterValue([], [option.value]);
        return { ...option, id: value, value, label: getDeviceStatusConfig(option.value).label };
      }),
      ...status
        .filter(option => connectivity.length === 0 || option.value !== DEVICE_STATUS.MANAGED)
        .map(option => ({ ...option, label: getDeviceStatusConfig(option.value).label })),
    ];
    return { ...buildOtherFilterOptions(deviceFilters), status: legacyStatus, connectivity: [] };
  }

  return { ...buildOtherFilterOptions(deviceFilters), status, connectivity };
}

/** The STATUS funnel's extra group: Connectivity, when the backend counts it. */
function connectivitySections(options: DeviceFilterOption[]): DataTableFilterSection[] | undefined {
  return options.length > 0 ? [{ id: DEVICE_CONNECTIVITY_FILTER_SECTION, title: 'Connectivity', options }] : undefined;
}

/** The directory columns of a device list: the table and its filter window take the same ones. */
interface DeviceDirectoryColumnOptions {
  directoryColumns?: boolean;
  roomyDirectory?: boolean;
  /** The host's status display (`useDeviceStatusDisplay()`): the STATUS options follow it. Default `lifecycle`. */
  statusDisplay?: DeviceStatusDisplay;
}

// Filter column metadata used by the external filter modal (useTagFilterModal).
// Kept separate from the table ColumnDef because DataTable doesn't carry the
// filter metadata that the external mobile filter modal needs.
// `roomyDirectory` is the table's own (`getDeviceTableColumns`): beside the customer column SOURCES shows only from
// `xl`, and the header has no funnel for it from `lg` until then, so the window carries it there.
export function getDeviceFilterColumns(
  deviceFilters?: DeviceFilters | null,
  { directoryColumns = false, roomyDirectory = false, statusDisplay = 'lifecycle' }: DeviceDirectoryColumnOptions = {},
): DeviceFilterColumn[] {
  const options = buildDeviceFilterOptions(deviceFilters, statusDisplay);
  return [
    {
      key: 'device',
      label: 'DEVICE',
    },
    ...(directoryColumns
      ? [
          { key: 'user', label: 'USER', filterable: true, filterOptions: options.user },
          {
            key: 'sources',
            label: 'SOURCES',
            filterable: true,
            filterOptions: options.sources,
            inWindowLgToXl: !roomyDirectory,
          },
        ]
      : []),
    { key: 'status', label: 'STATUS', filterable: true, filterOptions: options.status },
    // Only from a backend that counts connectivity: an empty group would offer nothing to pick.
    ...(options.connectivity.length > 0
      ? [
          {
            key: DEVICE_CONNECTIVITY_FILTER_SECTION,
            label: 'CONNECTIVITY',
            filterable: true,
            filterOptions: options.connectivity,
          },
        ]
      : []),
    { key: 'os', label: 'OS', filterable: true, filterOptions: options.os },
    { key: 'organization', label: 'CUSTOMER', filterable: true, filterOptions: options.organization },
  ];
}

/**
 * @param filtersPending The `deviceFilters` query is in flight, keeps the
 * funnels drawn (inert) rather than growing them when it answers. Absent means
 * these are the final options: an empty one then hides its funnel, which is what
 * a list with no facet source of its own wants.
 * @param options.directoryColumns Adds USER and SOURCES after DEVICE. Off by default: a picker or a tenant with no
 * directories has neither.
 * @param options.roomyDirectory No customer column beside them (one customer's list), so SOURCES shows from `lg`
 * rather than `xl`.
 */
export function getDeviceTableColumns<T extends DeviceRow = DeviceRow>(
  deviceFilters?: DeviceFilters | null,
  filtersPending?: boolean,
  { directoryColumns = false, roomyDirectory = false, statusDisplay = 'lifecycle' }: DeviceDirectoryColumnOptions = {},
): ColumnDef<T>[] {
  const {
    status: statusFilterOptions,
    connectivity: connectivityFilterOptions,
    os: osFilterOptions,
    organization: orgFilterOptions,
    user: userFilterOptions,
    sources: sourcesFilterOptions,
  } = buildDeviceFilterOptions(deviceFilters, statusDisplay);

  const directory: ColumnDef<T>[] = directoryColumns
    ? [
        {
          id: 'user',
          header: 'USER',
          cell: ({ row }: { row: Row<T> }) => <DirectoryUserCell device={row.original} />,
          enableSorting: false,
          size: 200,
          meta: {
            label: 'User',
            gridCell: ({ row }) => <DirectoryUserGridCell device={row.original} />,
            width: 'min-w-0 content-lg:w-[15%]',
            hideAt: 'lg',
            filter: { options: userFilterOptions, pending: filtersPending },
          },
        },
        {
          id: 'sources',
          header: 'SOURCES',
          cell: ({ row }: { row: Row<T> }) => <DirectorySourcesCell sources={row.original.directorySources} />,
          enableSorting: false,
          size: 220,
          meta: {
            label: 'Sources',
            gridCell: ({ row }) => <DirectorySourcesGridCell sources={row.original.directorySources} />,
            width: 'min-w-0 content-lg:w-[11%]',
            hideAt: roomyDirectory ? 'lg' : 'xl',
            filter: { options: sourcesFilterOptions, pending: filtersPending },
          },
        },
      ]
    : [];

  return [
    {
      accessorKey: 'device',
      id: 'device',
      header: 'DEVICE',
      cell: ({ row }: { row: Row<T> }) => <DeviceNameTableCell device={row.original} />,
      // The name takes what the other columns leave: with two more of them, their shares below shrink to leave some.
      size: 280,
      minSize: GRID_MIN_WIDTH.icon,
      meta: {
        label: 'Device',
        width: directoryColumns ? 'flex-1 min-w-0' : 'flex-1 content-md:w-1/4',
        gridCell: ({ row }) => <DeviceNameGridCell device={row.original} />,
      },
    },
    ...directory,
    {
      accessorKey: 'status',
      id: 'status',
      header: 'STATUS',
      cell: ({ row }: { row: Row<T> }) => {
        const device = row.original;
        return (
          <div className="flex shrink-0 flex-col items-start gap-1">
            <div className="inline-flex">
              <DeviceLifecycleTag status={device.status} connectivity={device.connectivity ?? null} />
            </div>
            <DeviceLastSeen lastSeen={device.last_seen} />
          </div>
        );
      },
      // The design's 200 holds a relative time ("1 hour ago"); the absolute date and time shown today needs 240.
      size: 240,
      meta: {
        label: 'Status',
        gridCell: ({ row }) => <DeviceStatusGridCell device={row.original} />,
        width: directoryColumns ? 'w-auto shrink-0 content-md:w-[14%]' : 'w-auto shrink-0 content-md:w-1/5',
        // Declared unconditionally, empty options and all. `meta.filter` is what
        // keeps a header cell visible below `lg`, so dropping it until the
        // options query resolves made every header on a tablet disappear on
        // reload, and reserving the funnel from the start keeps the label from
        // shifting when they arrive. The dropdown stays shut while it is empty.
        filter: {
          options: statusFilterOptions,
          sections: connectivitySections(connectivityFilterOptions),
          pending: filtersPending,
        },
      },
    },
    {
      accessorKey: 'os',
      id: 'os',
      header: 'OS',
      cell: ({ row }: { row: Row<T> }) => (
        <OSTypeBadge osType={row.original.osType} iconSize="w-4 h-4 content-md:w-6 content-md:h-6" />
      ),
      size: 160,
      minSize: GRID_MIN_WIDTH.icon,
      meta: {
        label: 'OS',
        gridCell: ({ row }) => (
          <OSTypeBadge osType={row.original.osType} iconSize="w-5 h-5" className="min-w-0 truncate" />
        ),
        width: directoryColumns ? 'w-[200px] content-md:w-[10%]' : 'w-[200px] content-md:w-1/6',
        hideAt: 'md',
        filter: { options: osFilterOptions, pending: filtersPending },
      },
    },
    {
      accessorKey: 'organization',
      id: 'organization',
      header: 'CUSTOMER',
      cell: ({ row }: { row: Row<T> }) => <OrganizationCell device={row.original} />,
      size: 280,
      minSize: GRID_MIN_WIDTH.media,
      meta: {
        label: 'Customer',
        gridCell: ({ row }) => <OrganizationGridCell device={row.original} />,
        width: directoryColumns ? 'w-[14%]' : 'w-1/6',
        hideAt: 'lg',
        filter: { options: orgFilterOptions, placement: 'bottom-end', pending: filtersPending },
      },
    },
  ];
}

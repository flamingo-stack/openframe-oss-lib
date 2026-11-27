'use client';

import type React from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { useChatRuntime } from '../../../contexts/chat-runtime-context';
import { cn } from '../../../utils/cn';
import { executeNewTabNavigation } from '../../chat/utils/execute-navigation';
import { ArrowRightUpIcon, MonitorIcon } from '../../icons-v2-generated';
import { MediaSkeleton, TextLineSkeleton } from '../../loading/unified-skeleton';
import {
  Button,
  type ColumnDef,
  DataTable,
  type DataTableFilterSection,
  EntityImage,
  GRID_MIN_WIDTH,
  GRID_ACTION_COLUMN_SIZE,
  type Row,
  Tag,
  TruncateText,
  useLoadingScope,
} from '../../ui';
import { DATA_TABLE_CELL_HUG_TAG_CLASS, DATA_TABLE_CELL_HUG_TEXT_CLASS } from '../../ui/data-table/data-table-cell';
import { OSTypeBadge } from '../os-type-badge';
import { DeviceConnectivityIcon } from './device-connectivity-icon';
import { directorySourceLabel, directoryUserLines, directoryUserLinkLabel } from './device-directory';
import { formatDeviceDateTime } from './device-last-online';
import { DeviceLastSeenCell } from './device-last-seen-cell';
import { DeviceLifecycleTag } from './device-lifecycle-tag';
import { getDeviceName } from './device-name';
import { DeviceOutdatedIcon } from './device-outdated-icon';
import { getDeviceConnectivityConfig, getDeviceLifecycleConfig, getDeviceStatusConfig } from './device-status';
import { type DeviceStatusDisplay, useDeviceStatusDisplay } from './device-status-display';
import { devicePendingHint } from './device-status-hint';
import {
  DEFAULT_VISIBLE_STATUSES,
  DEVICE_CONNECTIVITY_FILTER_SECTION,
  DEVICE_CONNECTIVITY_VALUES,
  DEVICE_FILTER_OUTDATED,
  DEVICE_STATUS,
  isManagedStatus,
  joinStatusFilterValue,
  mergeStatusFacets,
  showsOutdatedAgentMark,
} from './device-statuses';
import { DeviceTagHint } from './device-tag-hint';
import { renderDeviceTypeIcon } from './device-type-icon';
import { DeviceTypeTile } from './device-type-tile';
import { DeviceUnreadIndicator } from './device-unread-indicator';
import { useDeviceImageUrl, useDevicesViewConfig } from './devices-view-config';
import type { DeviceFilters, DeviceRow } from './types';

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
      {lastSeen ? formatDeviceDateTime(lastSeen) : 'Never'}
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

/** The DEVICE column's width in the grid: the lifecycle display's name carries its tag and mark (Figma 5262:159608). */
const DEVICE_COLUMN_SIZE = { lifecycle: 380, legacy: 280 } as const;

/**
 * What follows a device's name in the lifecycle display (Figma 5262-160005): its lifecycle `tag` unless it is managed
 * (most devices are, and need no word), with the PENDING tag's hint, then the outdated-agent `mark`. Either is null when
 * it does not show; a row still being read has no status, so it draws neither.
 *
 * On a short line the name gives way first, down to its floor; then the tag does, cutting its own label (its full
 * label in its tooltip), so it never spills over the mark (`DATA_TABLE_CELL_HUG_TAG_CLASS`). The mark never shrinks.
 */
function deviceNameStatus(device: DeviceRow): { tag: ReactNode; mark: ReactNode } {
  const hasTag = !!device.status && !isManagedStatus(device.status);
  const tagElement = hasTag ? (
    <DeviceLifecycleTag
      status={device.status}
      connectivity={device.connectivity}
      size="compact"
      className="min-w-0 overflow-hidden"
      data-device-name-status
    />
  ) : null;
  const hint = hasTag ? devicePendingHint(device.status, 'lifecycle') : null;
  return {
    tag:
      tagElement && hint ? (
        <DeviceTagHint hint={hint} shrink>
          {tagElement}
        </DeviceTagHint>
      ) : (
        tagElement
      ),
    mark: showsOutdatedAgentMark(device.clientOutdated, device.status) ? (
      <DeviceOutdatedIcon clientOutdated={device.clientOutdated} status={device.status} />
    ) : null,
  };
}

/**
 * The table's DEVICE cell: the connectivity icon (the type tile in the legacy display), the name, the unread mark. In
 * the lifecycle display the name's tag and outdated mark follow it on its line (`deviceNameStatus`), by the grid cell's
 * rule (`DataTable.Cell` `hugText`): the name gives way first, down to its floor, then the tag.
 */
function DeviceNameTableCell({ device }: { device: DeviceRow }) {
  const legacy = useDeviceStatusDisplay() === 'legacy';
  const { tag, mark } = legacy ? { tag: null, mark: null } : deviceNameStatus(device);
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
      {tag || mark ? (
        <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xxs)]">
          <div className={cn('min-w-0', DATA_TABLE_CELL_HUG_TEXT_CLASS)}>
            <TruncateText>{getDeviceName(device)}</TruncateText>
          </div>
          {tag && (
            <div data-device-name-tag className={DATA_TABLE_CELL_HUG_TAG_CLASS}>
              {tag}
            </div>
          )}
          {mark && <div className="flex shrink-0">{mark}</div>}
        </div>
      ) : (
        <div className="min-w-0 flex-1">
          <TruncateText>{getDeviceName(device)}</TruncateText>
        </div>
      )}
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

/**
 * The device's connectivity icon (its type icon in the legacy display), its name, and its unread mark at the end. In
 * the lifecycle display the name's tag and outdated mark follow it (`deviceNameStatus`), right after the name: the name
 * gives way first, down to its floor, then the tag; the mark and the unread mark never do.
 * `unreadMark={false}` leaves the mark out: a list a device is picked from (`DeviceSelector`) is not where its
 * notifications are read. `statusAdornments={false}` leaves the tag and the outdated mark out: a list with a status
 * column of its own (`DeviceSelector`) would show the tag twice.
 */
export function DeviceNameGridCell({
  device,
  unreadMark = true,
  statusAdornments = true,
}: {
  device: DeviceRow;
  unreadMark?: boolean;
  statusAdornments?: boolean;
}) {
  const lifecycle = useDeviceStatusDisplay() === 'lifecycle';
  const unread = unreadMark && (device.unreadNotificationCount ?? 0) > 0;
  const { tag, mark } = statusAdornments && lifecycle ? deviceNameStatus(device) : { tag: null, mark: null };
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
      tag={tag ?? undefined}
      mark={mark ?? undefined}
      hugText={tag != null || mark != null}
      trailing={unread ? <DeviceUnreadIndicator device={device} /> : undefined}
    />
  );
}

/** The status tag with when the device was last seen beside it. */
function DeviceStatusGridCell({ device }: { device: DeviceRow }) {
  const loading = useLoadingScope();
  // While the row is read there is no "last seen" to print: the tag's own skeleton is the cell.
  const lastSeen =
    loading && !device.last_seen ? undefined : device.last_seen ? formatDeviceDateTime(device.last_seen) : 'Never';
  return (
    <DataTable.Cell
      tag={
        <DeviceLifecycleTag
          status={device.status}
          connectivity={device.connectivity}
          clientOutdated={device.clientOutdated}
        />
      }
      secondary={lastSeen}
    />
  );
}

/** The customer's logo and name. */
export function OrganizationGridCell({ device }: { device: DeviceRow }) {
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
  // OUTDATED rides in the Status funnel in either display, counted by its own facet; a host without that facet gets
  // no option.
  if (deviceFilters?.clientOutdated) {
    status.push({
      id: DEVICE_FILTER_OUTDATED,
      label: getDeviceStatusConfig(DEVICE_FILTER_OUTDATED).label,
      value: DEVICE_FILTER_OUTDATED,
      count: deviceFilters.clientOutdated.find(option => option.value === 'true')?.count ?? 0,
    });
  }

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

  // Declared unconditionally, empty options and all. `meta.filter` is what keeps a header cell visible below `lg`, so
  // dropping it until the options query resolves made every header on a tablet disappear on reload, and reserving the
  // funnel from the start keeps the label from shifting when they arrive. The dropdown stays shut while it is empty.
  const statusFilter = {
    options: statusFilterOptions,
    sections: connectivitySections(connectivityFilterOptions),
    pending: filtersPending,
  };
  // The lifecycle display (Figma 5262-159608) has no STATUS column: the status is the tag after the name, the status
  // funnel sits on DEVICE (stored as `status`, so the hosts' filters and URL do not change), and LAST SEEN takes the
  // STATUS column's place. The legacy display keeps the STATUS column as it was.
  const lifecycle = statusDisplay === 'lifecycle';

  const statusColumn: ColumnDef<T> = {
    accessorKey: 'status',
    id: 'status',
    header: 'STATUS',
    cell: ({ row }: { row: Row<T> }) => {
      const device = row.original;
      return (
        <div className="flex shrink-0 flex-col items-start gap-1">
          <div className="inline-flex">
            <DeviceLifecycleTag
              status={device.status}
              connectivity={device.connectivity}
              clientOutdated={device.clientOutdated}
            />
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
      filter: statusFilter,
    },
  };

  const lastSeenColumn: ColumnDef<T> = {
    id: 'lastSeen',
    header: 'LAST SEEN',
    cell: ({ row }: { row: Row<T> }) => <DeviceLastSeenCell device={row.original} />,
    // Holds a day-first date and time ("26/11/2026 15:27") whole.
    size: 180,
    meta: {
      label: 'Last seen',
      gridCell: ({ row }) => <DeviceLastSeenCell device={row.original} grid />,
      // The STATUS column's share, so the columns around it keep theirs; below `md` a card row has no room for it.
      width: directoryColumns ? 'w-auto shrink-0 content-md:w-[14%]' : 'w-auto shrink-0 content-md:w-1/5',
      hideAt: 'md',
    },
  };

  return [
    {
      accessorKey: 'device',
      id: 'device',
      header: 'DEVICE',
      cell: ({ row }: { row: Row<T> }) => <DeviceNameTableCell device={row.original} />,
      // The name takes what the other columns leave: with two more of them, their shares below shrink to leave some.
      // The grid draws it wider in the lifecycle display, where the tag and the mark share the name's line.
      size: DEVICE_COLUMN_SIZE[statusDisplay],
      minSize: GRID_MIN_WIDTH.icon,
      // It carries the status funnel in the lifecycle display: the gear menu cannot hide it.
      ...(lifecycle ? { enableHiding: false } : {}),
      meta: {
        label: 'Device',
        width: directoryColumns ? 'flex-1 min-w-0' : 'flex-1 content-md:w-1/4',
        gridCell: ({ row }) => <DeviceNameGridCell device={row.original} />,
        ...(lifecycle ? { filter: { ...statusFilter, id: 'status', title: 'Status' } } : {}),
      },
    },
    ...directory,
    lifecycle ? lastSeenColumn : statusColumn,
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

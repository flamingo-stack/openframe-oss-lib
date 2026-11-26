'use client';

import type React from 'react';
import type { MouseEvent } from 'react';
import { useChatRuntime } from '../../../contexts/chat-runtime-context';
import { cn } from '../../../utils/cn';
import { formatDate, formatTime } from '../../../utils/format-date';
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
  DEVICE_FILTER_OUTDATED,
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

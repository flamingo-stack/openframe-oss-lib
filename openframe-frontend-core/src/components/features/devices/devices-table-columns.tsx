'use client';

import type React from 'react';
import { type MouseEvent, type ReactNode, useMemo } from 'react';
import { formatDate, formatTime } from '../../../utils/format-date';
import { ArrowRightUpIcon } from '../../icons-v2-generated';
import {
  Button,
  type ColumnDef,
  type ColumnFiltersState,
  DataTable,
  EntityImage,
  type NoDataProps,
  type OnChangeFn,
  type Row,
  Tag,
  TruncateText,
  useDataTable,
} from '../../ui';
import { OSTypeBadge } from '../os-type-badge';
import { getDeviceName } from './device-name';
import { getDeviceStatusConfig } from './device-status';
import { DEFAULT_VISIBLE_STATUSES } from './device-statuses';
import { DeviceTypeTile } from './device-type-tile';
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
    meta: { width: 'w-12 shrink-0 flex-none', align: 'right' },
  };
}

/** Opens the device's page in a new tab. A button, because the row is itself a link and a link cannot hold a link. */
function OpenDeviceButton({ device }: { device: DeviceRow }) {
  const { getDeviceHref } = useDevicesViewConfig();
  const href = getDeviceHref?.(device);
  const open = (event: MouseEvent) => {
    event.preventDefault();
    if (href) window.open(href, '_blank', 'noopener,noreferrer');
  };
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <Button
        onClick={open}
        variant="outline"
        size="icon"
        leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
        aria-label="Open in new tab"
        className="bg-ods-card"
      />
    </div>
  );
}

export function getDeviceOpenColumn<T extends DeviceRow = DeviceRow>(): ColumnDef<T> {
  return {
    id: 'open',
    cell: ({ row }: { row: Row<T> }) => <OpenDeviceButton device={row.original} />,
    enableSorting: false,
    meta: { width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
  };
}

export interface DevicesTableBodyProps<T extends DeviceRow = DeviceRow> {
  devices: T[];
  isLoading?: boolean;
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
}

export function DevicesTableBody<T extends DeviceRow = DeviceRow>({
  devices,
  isLoading,
  emptyState,
  emptyMessage = 'No devices found.',
  skeletonRows = 10,
  stickyHeaderOffset,
  footerSlot,
  deviceFilters,
  columnFilters,
  onColumnFiltersChange,
  actionsColumn,
  hideColumns,
  disableColumnFilters,
  filtersPending,
  totalCount,
  showHeader = true,
}: DevicesTableBodyProps<T>) {
  const { getDeviceHref } = useDevicesViewConfig();
  const columns = useMemo<ColumnDef<T>[]>(() => {
    const hidden = new Set(hideColumns ?? []);
    const unfiltered = new Set(disableColumnFilters ?? []);
    const base = getDeviceTableColumns<T>(deviceFilters ?? null, filtersPending)
      .filter(c => !c.id || !hidden.has(c.id))
      .map(c => (c.id && unfiltered.has(c.id) ? { ...c, meta: { ...c.meta, filter: undefined } } : c));
    const open = getDeviceOpenColumn<T>();
    return actionsColumn ? [...base, actionsColumn, open] : [...base, open];
  }, [deviceFilters, filtersPending, actionsColumn, hideColumns, disableColumnFilters]);

  const table = useDataTable<T>({
    data: devices,
    columns,
    // `machineId` is EMPTY (not absent) while the agent is not connected: those rows key on their id.
    getRowId: row => String(row.machineId || row.id),
    enableSorting: false,
    state: columnFilters !== undefined ? { columnFilters } : undefined,
    onColumnFiltersChange,
  });

  return (
    <DataTable table={table}>
      {showHeader && (
        <DataTable.Header
          stickyHeader={!!stickyHeaderOffset}
          stickyHeaderOffset={stickyHeaderOffset}
          rightSlot={<DataTable.RowCount itemName="device" totalCount={totalCount} />}
        />
      )}
      <DataTable.Body
        loading={isLoading}
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
        <span className="break-words text-ods-text-primary text-h4">{device.organization || ''}</span>
      </div>
    </div>
  );
}

export interface DeviceFilterColumn {
  key: string;
  label: string;
  filterable?: boolean;
  filterOptions?: DeviceFilterOption[];
}

/** A device filter dropdown entry: `meta.filter.options` plus the facet count. */
export interface DeviceFilterOption {
  id: string;
  label: string;
  value: string;
  count?: number;
}

/** Status / OS / customer options, shared by the table headers and the grid row. */
function buildDeviceFilterOptions(deviceFilters?: DeviceFilters | null): {
  status: DeviceFilterOption[];
  os: DeviceFilterOption[];
  organization: DeviceFilterOption[];
} {
  // Show only DEFAULT_VISIBLE_STATUSES (DELETED and legacy ARCHIVED live on /devices/archive)
  const status = (deviceFilters?.statuses ?? [])
    .filter(s => (DEFAULT_VISIBLE_STATUSES as readonly string[]).includes(s.value))
    .map(s => ({ id: s.value, label: getDeviceStatusConfig(s.value).label, value: s.value, count: s.count }));

  const os = (deviceFilters?.osTypes ?? []).map(o => ({ id: o.value, label: o.value, value: o.value, count: o.count }));

  const organization = uniqueById(
    (deviceFilters?.organizationIds ?? []).map(org => ({
      id: org.value,
      label: org.label,
      value: org.value,
      count: org.count,
    })),
  );

  return { status, os, organization };
}

// Filter column metadata used by the external filter modal (useTagFilterModal).
// Kept separate from the table ColumnDef because DataTable doesn't carry the
// filter metadata that the external mobile filter modal needs.
export function getDeviceFilterColumns(deviceFilters?: DeviceFilters | null): DeviceFilterColumn[] {
  const options = buildDeviceFilterOptions(deviceFilters);
  return [
    {
      key: 'device',
      label: 'DEVICE',
    },
    { key: 'status', label: 'STATUS', filterable: true, filterOptions: options.status },
    { key: 'os', label: 'OS', filterable: true, filterOptions: options.os },
    { key: 'organization', label: 'CUSTOMER', filterable: true, filterOptions: options.organization },
  ];
}

/**
 * @param filtersPending The `deviceFilters` query is in flight, keeps the
 * funnels drawn (inert) rather than growing them when it answers. Absent means
 * these are the final options: an empty one then hides its funnel, which is what
 * a list with no facet source of its own wants.
 */
export function getDeviceTableColumns<T extends DeviceRow = DeviceRow>(
  deviceFilters?: DeviceFilters | null,
  filtersPending?: boolean,
): ColumnDef<T>[] {
  const {
    status: statusFilterOptions,
    os: osFilterOptions,
    organization: orgFilterOptions,
  } = buildDeviceFilterOptions(deviceFilters);

  return [
    {
      accessorKey: 'device',
      id: 'device',
      header: 'DEVICE',
      cell: ({ row }: { row: Row<T> }) => {
        const device = row.original;
        return (
          <div className="relative box-border flex h-20 w-full shrink-0 content-stretch items-center justify-start gap-4 py-0">
            <DeviceTypeTile type={device.type} />
            <div className="min-w-0 flex-1">
              <TruncateText>{getDeviceName(device)}</TruncateText>
            </div>
          </div>
        );
      },
      meta: { width: 'flex-1 content-md:w-1/4' },
    },
    {
      accessorKey: 'status',
      id: 'status',
      header: 'STATUS',
      cell: ({ row }: { row: Row<T> }) => {
        const device = row.original;
        const statusConfig = getDeviceStatusConfig(device.status);
        return (
          <div className="flex shrink-0 flex-col items-start gap-1">
            <div className="inline-flex">
              <Tag label={statusConfig.label} variant={statusConfig.variant} />
            </div>
            <span className="hidden text-ods-text-secondary text-h6 content-md:flex">
              {device.last_seen ? formatDateTime(device.last_seen) : 'Never'}
            </span>
          </div>
        );
      },
      meta: {
        width: 'w-auto shrink-0 content-md:w-1/5',
        // Declared unconditionally, empty options and all. `meta.filter` is what
        // keeps a header cell visible below `lg`, so dropping it until the
        // options query resolves made every header on a tablet disappear on
        // reload, and reserving the funnel from the start keeps the label from
        // shifting when they arrive. The dropdown stays shut while it is empty.
        filter: { options: statusFilterOptions, pending: filtersPending },
      },
    },
    {
      accessorKey: 'os',
      id: 'os',
      header: 'OS',
      cell: ({ row }: { row: Row<T> }) => (
        <OSTypeBadge osType={row.original.osType} iconSize="w-4 h-4 content-md:w-6 content-md:h-6" />
      ),
      meta: {
        width: 'w-[200px] content-md:w-1/6',
        hideAt: 'md',
        filter: { options: osFilterOptions, pending: filtersPending },
      },
    },
    {
      accessorKey: 'organization',
      id: 'organization',
      header: 'CUSTOMER',
      cell: ({ row }: { row: Row<T> }) => <OrganizationCell device={row.original} />,
      meta: {
        width: 'w-1/6',
        hideAt: 'lg',
        filter: { options: orgFilterOptions, placement: 'bottom-end', pending: filtersPending },
      },
    },
  ];
}

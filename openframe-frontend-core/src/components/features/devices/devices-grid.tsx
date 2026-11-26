'use client';

import type React from 'react';
import { useRouter } from '../../../embed-shims/next-navigation';
import { LoadingRegion } from '../../loading/loading-region';
import { DeviceCard, type DeviceCardStatusLine } from '../../ui';
import { LoadingItems, useLoadingScope } from '../../ui/loading-scope';
import { formatDeviceDateTime } from './device-last-online';
import { deviceLifecycleTagProps } from './device-lifecycle-tag';
import { getDeviceName } from './device-name';
import { getDeviceOperatingSystem } from './device-status';
import { type DeviceStatusDisplay, useDeviceStatusDisplay } from './device-status-display';
import { DeviceOutdatedIcon, devicePendingHint } from './device-status-hint';
import { isArchiveLifecycleStatus, isManagedStatus } from './device-statuses';
import { DeviceUnreadIndicator } from './device-unread-indicator';
import { useDevicesViewConfig } from './devices-view-config';
import type { DeviceRow } from './types';

export interface DevicesGridProps<T extends DeviceRow = DeviceRow> {
  devices: T[];
  isLoading: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  sentinelRef?: React.RefObject<HTMLDivElement | null>;
  emptyMessage?: string;
  /** The loading state announces itself ("Loading devices"). `false` inside another loading region. Default `true`. */
  loadingRegion?: boolean;
  /**
   * The host's page size: the loading grid draws one full page of cards, and the next page's skeleton the same.
   * Omitted, it falls back to {@link DEVICES_GRID_SKELETON_CARDS}.
   */
  pageSize?: number;
}

/** The devices grid: one column, two from `content-md`, three from `content-lg` (its cards and its next page). */
const DEVICES_GRID_CLASS = 'grid grid-cols-1 gap-4 content-md:grid-cols-2 content-lg:grid-cols-3';

/** The cards a loading grid draws when the host states no page size. */
export const DEVICES_GRID_SKELETON_CARDS = 12;

/** The grid's cards carry no "more" button (the card opens the device), loaded and loading alike. */
const GRID_CARD_ACTIONS = { moreButton: { visible: false } };

/**
 * A card's status row in the lifecycle display (Figma 5108-199992): a managed device reads "Managed · Last seen <date>"
 * (just "Managed" if never seen) in place of the tag, any other status keeps its tag (the PENDING one with its hint),
 * and an outdated agent's mark follows either. The legacy display keeps the tag and "Last Seen:" (`undefined`).
 */
function deviceCardStatusLine(device: DeviceRow, display: DeviceStatusDisplay): DeviceCardStatusLine | undefined {
  if (display !== 'lifecycle') return undefined;
  const lastSeen = device.last_seen ?? device.lastSeen;
  const outdated = device.clientOutdated === true && !isArchiveLifecycleStatus(device.status);
  return {
    text: isManagedStatus(device.status)
      ? lastSeen
        ? `Managed · Last seen ${formatDeviceDateTime(lastSeen)}`
        : 'Managed'
      : undefined,
    tagHint: devicePendingHint(device.status, display),
    adornment: outdated ? (
      <DeviceOutdatedIcon clientOutdated={device.clientOutdated} status={device.status} />
    ) : undefined,
  };
}

/** A page of the grid's own cards while they are read (the first page and the next one alike), each a list item. */
function DeviceCardLoadingPage({ count }: { count: number }) {
  return (
    <LoadingItems count={count}>
      {() => (
        <DeviceCard loading device={{ name: '' }} actions={GRID_CARD_ACTIONS} className="h-full" data-loading-item />
      )}
    </LoadingItems>
  );
}

export function DevicesGrid<T extends DeviceRow = DeviceRow>({
  devices,
  isLoading: isLoadingProp,
  hasNextPage,
  isFetchingNextPage,
  sentinelRef,
  emptyMessage = 'No devices found. Try adjusting your search or filters.',
  loadingRegion = true,
  pageSize = DEVICES_GRID_SKELETON_CARDS,
}: DevicesGridProps<T>) {
  // ONE switch: in a page's loading state (or while the host reads the devices) the grid is its skeleton.
  const isLoading = useLoadingScope() || isLoadingProp;
  const router = useRouter();
  const { getDeviceHref } = useDevicesViewConfig();
  const display = useDeviceStatusDisplay();

  const handleDeviceClick = (device: T) => {
    const href = device.machineId || device.id ? getDeviceHref?.(device) : undefined;
    if (href) router.push(href);
  };

  return (
    <div className="space-y-4">
      {isLoading && devices.length === 0 ? (
        // A full page of the grid's own cards, each its own skeleton (no "more" button, as the loaded cards).
        <LoadingRegion label="Loading devices" announce={loadingRegion} className={DEVICES_GRID_CLASS}>
          <DeviceCardLoadingPage count={pageSize} />
        </LoadingRegion>
      ) : devices.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-[6px] border border-ods-border bg-ods-card">
          <p className="text-ods-text-secondary">{emptyMessage}</p>
        </div>
      ) : (
        <>
          <div className={DEVICES_GRID_CLASS}>
            {devices.map(device => {
              return (
                <DeviceCard
                  key={device.id || device.machineId}
                  device={{
                    id: device.id,
                    machineId: device.machineId,
                    name: getDeviceName(device),
                    organization: device.organization || device.machineId,
                    lastSeen: device.lastSeen,
                    operatingSystem: getDeviceOperatingSystem(device.osType),
                  }}
                  statusTag={
                    device.status || (display === 'legacy' && device.clientOutdated)
                      ? deviceLifecycleTagProps(device.status, {
                          connectivity: device.connectivity,
                          display,
                          clientOutdated: device.clientOutdated,
                        })
                      : undefined
                  }
                  statusLine={deviceCardStatusLine(device, display)}
                  connectivity={device.connectivity ?? null}
                  onDeviceClick={() => handleDeviceClick(device)}
                  actions={
                    device.unreadNotificationCount
                      ? {
                          ...GRID_CARD_ACTIONS,
                          detailsButton: { component: <DeviceUnreadIndicator device={device} /> },
                        }
                      : GRID_CARD_ACTIONS
                  }
                  className="h-full"
                  // One card of a read list: how many there are is the record's (the height gate counts them).
                  data-loading-item
                />
              );
            })}
            {isFetchingNextPage && <DeviceCardLoadingPage count={pageSize} />}
          </div>
          {hasNextPage && <div ref={sentinelRef} className="h-1" aria-hidden="true" />}
        </>
      )}
    </div>
  );
}

'use client';

import type React from 'react';
import { useRouter } from '../../../embed-shims/next-navigation';
import { DEVICES_GRID_CLASS } from '../../loading/device-card-skeleton';
import { LoadingRegion } from '../../loading/loading-region';
import { DeviceCard } from '../../ui';
import { useLoadingScope } from '../../ui/loading-scope';
import { getDeviceName } from './device-name';
import { getDeviceOperatingSystem, getDeviceStatusConfig } from './device-status';
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

/** The cards a loading grid draws when the host states no page size. */
export const DEVICES_GRID_SKELETON_CARDS = 12;

/** The grid's cards carry no "more" button (the card opens the device), loaded and loading alike. */
const GRID_CARD_ACTIONS = { moreButton: { visible: false } };

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

  const handleDeviceClick = (device: T) => {
    const href = device.machineId || device.id ? getDeviceHref?.(device) : undefined;
    if (href) router.push(href);
  };

  return (
    <div className="space-y-4">
      {isLoading && devices.length === 0 ? (
        // A full page of the grid's own cards, each its own skeleton (no "more" button, as the loaded cards).
        <LoadingRegion label="Loading devices" announce={loadingRegion} className={DEVICES_GRID_CLASS}>
          {Array.from({ length: pageSize }, (_, i) => (
            <DeviceCard
              key={`skeleton-${i}`}
              loading
              device={{ name: '' }}
              actions={GRID_CARD_ACTIONS}
              className="h-full"
              data-loading-item
            />
          ))}
        </LoadingRegion>
      ) : devices.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-[6px] border border-ods-border bg-ods-card">
          <p className="text-ods-text-secondary">{emptyMessage}</p>
        </div>
      ) : (
        <>
          <div className={DEVICES_GRID_CLASS}>
            {devices.map(device => {
              const statusConfig = getDeviceStatusConfig(device.status);
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
                    device.status
                      ? {
                          label: statusConfig.label,
                          variant: statusConfig.variant,
                        }
                      : undefined
                  }
                  onDeviceClick={() => handleDeviceClick(device)}
                  actions={GRID_CARD_ACTIONS}
                  className="h-full"
                  // One card of a read list: how many there are is the record's (the height gate counts them).
                  data-loading-item
                />
              );
            })}
            {isFetchingNextPage &&
              Array.from({ length: pageSize }, (_, i) => (
                <DeviceCard
                  key={`skeleton-${i}`}
                  loading
                  device={{ name: '' }}
                  actions={GRID_CARD_ACTIONS}
                  className="h-full"
                  data-loading-item
                />
              ))}
          </div>
          {hasNextPage && <div ref={sentinelRef} className="h-1" aria-hidden="true" />}
        </>
      )}
    </div>
  );
}

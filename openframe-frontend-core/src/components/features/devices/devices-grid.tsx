'use client';

import type React from 'react';
import { useRouter } from '../../../embed-shims/next-navigation';
import { DeviceCardSkeleton, DeviceCardSkeletonGrid } from '../../loading/device-card-skeleton';
import { DeviceCard } from '../../ui';
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
}

export function DevicesGrid<T extends DeviceRow = DeviceRow>({
  devices,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  sentinelRef,
  emptyMessage = 'No devices found. Try adjusting your search or filters.',
}: DevicesGridProps<T>) {
  const router = useRouter();
  const { getDeviceHref } = useDevicesViewConfig();

  const handleDeviceClick = (device: T) => {
    const href = device.machineId || device.id ? getDeviceHref?.(device) : undefined;
    if (href) router.push(href);
  };

  return (
    <div className="space-y-4">
      {isLoading && devices.length === 0 ? (
        <DeviceCardSkeletonGrid count={12} />
      ) : devices.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-[6px] border border-ods-border bg-ods-card">
          <p className="text-ods-text-secondary">{emptyMessage}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 content-md:grid-cols-2 content-lg:grid-cols-3">
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
                  actions={{
                    moreButton: {
                      visible: false,
                    },
                  }}
                  className="h-full"
                />
              );
            })}
            {isFetchingNextPage && Array.from({ length: 4 }, (_, i) => <DeviceCardSkeleton key={`skeleton-${i}`} />)}
          </div>
          {hasNextPage && <div ref={sentinelRef} className="h-1" aria-hidden="true" />}
        </>
      )}
    </div>
  );
}

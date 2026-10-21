'use client';

import type React from 'react';
import { cn } from '../../utils/cn';
import { formatDate, formatTime } from '../../utils/format-date';
import type { OSPlatformId } from '../../utils/os-platforms';
import { OSTypeIcon } from '../features/os-type-badge';
import { MonitorIcon } from '../icons-v2-generated/devices/monitor-icon';
import { Ellipsis01Icon } from '../icons-v2-generated/interface';
import { MediaSkeleton, TextLineSkeleton } from '../loading/unified-skeleton';
import { useLoadingScope } from './loading-scope';
import { Tag, type TagProps } from './tag';

/** The card's frame. */
export const DEVICE_CARD_FRAME_CLASS =
  'flex flex-col gap-4 overflow-clip rounded-[6px] border border-ods-border bg-ods-card p-4';
/** The card's first row: the device icon, the name stack, the buttons. */
export const DEVICE_CARD_HEAD_ROW_CLASS = 'flex w-full items-center gap-4';
/** The name stack: the OS icon and name line over the organization line. */
export const DEVICE_CARD_NAME_STACK_CLASS = 'flex min-w-0 flex-1 flex-col justify-center';
/** The OS icon and the name, one `text-h4` line. */
export const DEVICE_CARD_NAME_LINE_CLASS = 'flex items-center gap-1 text-h4';
/** The card's status row: the status tag and the "Last Seen:" line. */
export const DEVICE_CARD_STATUS_ROW_CLASS = 'flex w-full items-center gap-2';
/** The bordered box of the device-type icon. */
export const DEVICE_CARD_ICON_BOX_CLASS =
  'flex shrink-0 items-center justify-center rounded-[6px] border border-ods-border p-2';
/** The bordered "more" button. */
export const DEVICE_CARD_MORE_BUTTON_CLASS =
  'flex shrink-0 items-center justify-center rounded-[6px] border border-ods-border p-3';

export interface Device {
  id?: string;
  machineId?: string;
  name: string;
  type?: 'desktop' | 'laptop' | 'mobile' | 'tablet' | 'server';
  operatingSystem?: OSPlatformId | 'macos' | 'ios' | 'android'; // Support both OSPlatformId and legacy values
  organization?: string;
  status?: 'active' | 'inactive' | 'offline' | 'warning' | 'error';
  lastSeen?: string | Date;
  tags?: string[];
  // Additional device properties
  ipAddress?: string;
  macAddress?: string;
  version?: string;
  location?: string;
}

// Action button configuration
export interface ActionButton {
  label: string;
  onClick?: () => void;
  variant?: 'default' | 'outline' | 'secondary';
  visible?: boolean;
}

export interface DeviceCardProps extends React.HTMLAttributes<HTMLDivElement> {
  device: Device;
  actions?: {
    moreButton?: {
      visible?: boolean;
      onClick?: () => void;
    };
    detailsButton?: {
      visible?: boolean;
      component?: React.ReactNode;
    };
    customActions?: ActionButton[];
  };
  statusTag?: TagProps;
  onDeviceClick?: (device: Device) => void;
  /**
   * The device is still being read: the card keeps its ONE structure, inert, with its icon, its buttons and its labels
   * drawn for real and every read value (OS icon, name, organization, status, last seen) its own skeleton. A loading
   * scope does the same. The card's `data-*` markers (`data-loading-item`) ride on its root in both forms.
   */
  loading?: boolean;
}

export function DeviceCard({
  device,
  actions = {
    moreButton: { visible: true },
  },
  statusTag,
  onDeviceClick,
  loading: loadingProp,
  className,
  ...props
}: DeviceCardProps) {
  // ONE switch: in a page's loading state (or while the host reads the device) the card draws its read values as
  // skeletons, in the same boxes; its static parts stay real and the whole card is inert.
  const loading = useLoadingScope() || !!loadingProp;
  // "Last seen" is read as "your local time", the same way the devices table
  // column renders it: the viewer's zone and locale, never UTC.
  const formatLastSeen = (lastSeen?: string | Date) => {
    if (!lastSeen) return null;
    const date = formatDate(lastSeen);
    return date === '—' ? null : `${date} ${formatTime(lastSeen)}`;
  };

  return (
    <div
      onClick={onDeviceClick && !loading ? () => onDeviceClick(device) : undefined}
      className={cn(DEVICE_CARD_FRAME_CLASS, onDeviceClick && !loading && 'cursor-pointer', className)}
      inert={loading || undefined}
      aria-hidden={loading || undefined}
      {...props}
    >
      {/* Row 1: Device icon | OS icon + Name + Organization | More button | Details button | Custom actions */}
      <div className={DEVICE_CARD_HEAD_ROW_CLASS}>
        {/* Device type icon */}
        <div className={DEVICE_CARD_ICON_BOX_CLASS}>
          <MonitorIcon className="text-ods-text-secondary" size={16} />
        </div>

        {/* OS icon + Device name + Organization (stacked) */}
        <div className={DEVICE_CARD_NAME_STACK_CLASS}>
          <div className={DEVICE_CARD_NAME_LINE_CLASS}>
            {loading ? (
              <>
                <MediaSkeleton.Icon size="sm" className="shrink-0" />
                <TextLineSkeleton type="inherit" className="w-3/4" />
              </>
            ) : (
              <>
                {device.operatingSystem && (
                  <OSTypeIcon
                    osType={device.operatingSystem === 'macos' ? 'darwin' : device.operatingSystem}
                    size="w-4 h-4"
                    className="shrink-0"
                  />
                )}
                <span className="truncate text-ods-text-primary" title={device.name}>
                  {device.name}
                </span>
              </>
            )}
          </div>
          {loading ? (
            <TextLineSkeleton type="h6" className="w-1/2" />
          ) : (
            device.organization && (
              <span className="truncate text-ods-text-secondary text-h6" title={device.organization}>
                {device.organization}
              </span>
            )
          )}
        </div>

        {/* More button */}
        {actions.moreButton?.visible !== false && (
          <div
            className={cn(DEVICE_CARD_MORE_BUTTON_CLASS, 'cursor-pointer transition-colors hover:bg-ods-bg-hover')}
            onClick={e => {
              e.stopPropagation();
              actions.moreButton?.onClick?.();
            }}
          >
            <Ellipsis01Icon className="text-ods-text-primary" />
          </div>
        )}

        {/* Details button */}
        {actions.detailsButton?.visible !== false && actions.detailsButton?.component && (
          <div className="shrink-0" onClick={e => e.stopPropagation()}>
            {actions.detailsButton.component}
          </div>
        )}

        {/* Custom action buttons */}
        {actions.customActions?.map(
          (action, index) =>
            action.visible !== false && (
              <div
                key={index}
                className="flex shrink-0 cursor-pointer items-center justify-center rounded-[6px] border border-ods-border px-4 py-3 transition-colors hover:bg-ods-bg-hover"
                onClick={e => {
                  e.stopPropagation();
                  action.onClick?.();
                }}
              >
                <span className="text-nowrap text-ods-text-primary text-h3">{action.label}</span>
              </div>
            ),
        )}
      </div>

      {/* Row 2: Status badge | Last seen (both drawn while loading: the tag and the time are read) */}
      {(loading || statusTag || device.lastSeen) && (
        <div className={DEVICE_CARD_STATUS_ROW_CLASS}>
          {(loading || statusTag) && (
            <Tag
              loading={loading}
              variant={statusTag?.variant}
              icon={statusTag?.icon}
              onClose={statusTag?.onClose}
              className={statusTag?.className}
              label={statusTag?.label ?? ''}
            />
          )}
          {(loading || device.lastSeen) && (
            <span className="flex min-w-0 flex-1 items-center gap-1 text-ods-text-secondary text-h6">
              <span className="shrink-0">Last Seen:</span>
              {loading ? (
                <TextLineSkeleton type="inherit" as="span" className="w-28 max-w-full" />
              ) : (
                <span className="truncate">{formatLastSeen(device.lastSeen)}</span>
              )}
            </span>
          )}
        </div>
      )}

      {/* Tags section */}
      {!loading && device.tags && device.tags.length > 0 && (
        <div className="flex w-full flex-wrap items-center gap-2">
          {device.tags.map((tag, index) => (
            <Tag key={index} variant="outline" label={tag} />
          ))}
        </div>
      )}
    </div>
  );
}

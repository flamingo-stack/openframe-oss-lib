'use client';

import type { ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import { formatDate, formatTime } from '../../../utils/format-date';
import { DeviceOfflineIcon, DeviceOnlineIcon } from '../../icons-v2-generated';
import { MediaSkeleton } from '../../loading/unified-skeleton';
import { useLoadingScope } from '../../ui/loading-scope';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip';
import { getDeviceConnectivityConfig } from './device-status';
import { useDeviceStatusDisplay } from './device-status-display';

export interface DeviceConnectivityIconProps {
  /** ONLINE / OFFLINE; null or absent (never reported) reads as offline. */
  connectivity: string | null | undefined;
  /** When the device was last seen, ISO: the tooltip's second line. */
  lastSeen?: string | null;
  /** Default 24, the device column's (Figma 3324-6819). */
  size?: number;
  className?: string;
  /** Draws the icon's skeleton. A loading scope does the same. */
  loading?: boolean;
  /**
   * What the legacy display (`DeviceStatusDisplay`) draws in this icon's place: the view's icon from before the split
   * (its device type tile, say), which draws its own loading form. Nothing by default: a view that had no icon there.
   */
  legacyIcon?: ReactNode;
}

function lastSeenText(lastSeen: string | null | undefined): string {
  if (!lastSeen) return 'Never seen';
  const date = formatDate(lastSeen);
  return date === '—' ? 'Never seen' : `Last seen ${date} ${formatTime(lastSeen)}`;
}

/**
 * The device's icon that says whether it is online right now (Figma 3324-6819, `device-online` /
 * `device-offline`): a monitor with a green dot, or with a grey one. Only `connectivity` drives it, never the
 * lifecycle status. Hover or focus shows the state and when the device was last seen; the same text is its
 * accessible name, so the state never rests on colour alone. The legacy display draws `legacyIcon` instead.
 */
export function DeviceConnectivityIcon({
  connectivity,
  lastSeen,
  size = 24,
  className,
  loading: loadingProp,
  legacyIcon = null,
}: DeviceConnectivityIconProps) {
  const loading = useLoadingScope() || !!loadingProp;
  const display = useDeviceStatusDisplay();
  if (display === 'legacy') return <>{legacyIcon}</>;
  if (loading) return <MediaSkeleton.Icon size="sm" className={cn('shrink-0', className)} />;
  const { online, label } = getDeviceConnectivityConfig(connectivity);
  const Icon = online ? DeviceOnlineIcon : DeviceOfflineIcon;
  const description = `${label}. ${lastSeenText(lastSeen)}`;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="img"
            aria-label={description}
            data-connectivity={online ? 'online' : 'offline'}
            className={cn('inline-flex shrink-0 text-ods-text-secondary', className)}
          >
            <Icon size={size} aria-hidden />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-ods-text-primary">{label}</div>
          <div className="text-ods-text-secondary">{lastSeenText(lastSeen)}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

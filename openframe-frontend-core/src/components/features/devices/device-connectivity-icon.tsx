'use client';

import { type ReactNode, useState } from 'react';
import { cn } from '../../../utils/cn';
import { getDetailedTimeDifferenceFrom } from '../../../utils/date-utils';
import { formatDate, formatTime } from '../../../utils/format-date';
import { DeviceOfflineIcon, DeviceOnlineIcon } from '../../icons-v2-generated';
import { MediaSkeleton } from '../../loading/unified-skeleton';
import { useLoadingScope } from '../../ui/loading-scope';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip';
import { getDeviceConnectivityConfig } from './device-status';
import { useDeviceStatusDisplay } from './device-status-display';

export interface DeviceConnectivityIconProps {
  /** ONLINE / OFFLINE; null or absent means the device never reported, which reads as offline with a grey dot. */
  connectivity: string | null | undefined;
  /** When the device was last seen, ISO: the offline tooltip ("Last seen 2 days ago"). */
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

type ConnectivityState = 'online' | 'offline' | 'unknown';

function connectivityState(connectivity: string | null | undefined, online: boolean): ConnectivityState {
  if (online) return 'online';
  return connectivity ? 'offline' : 'unknown';
}

/** A readable `lastSeen`, or null when it is absent or not a date. */
function readableLastSeen(lastSeen: string | null | undefined): string | null {
  return lastSeen && formatDate(lastSeen) !== '—' ? lastSeen : null;
}

/** The accessible name: the state and the exact time, which does not age while the page stays open. */
function accessibleName(state: ConnectivityState, lastSeen: string | null): string {
  if (state === 'online') return 'Online';
  // Never reported reads as the grey dot and its tooltip do, whatever `lastSeen` holds.
  if (state === 'unknown') return 'Never seen';
  if (!lastSeen) return 'Offline. Never seen';
  return `Offline. Last seen ${formatDate(lastSeen)} ${formatTime(lastSeen)}`;
}

/** The tooltip's one line, relative to `openedAt`, the moment the tooltip opened. */
function tooltipText(state: ConnectivityState, lastSeen: string | null, openedAt: number): string {
  if (state === 'online') return 'Online';
  if (state === 'unknown' || !lastSeen) return 'Never seen';
  return `Last seen ${getDetailedTimeDifferenceFrom(lastSeen, openedAt)}`;
}

/**
 * The device's icon that says whether it is online right now (Figma 3324-6819, `device-online` /
 * `device-offline`; the offline red from Figma 3389-54149): a monitor with a green dot when online, a red one when
 * offline, and the icon's grey one when the device never reported its connectivity. Only `connectivity` drives it,
 * never the lifecycle status. Hover or keyboard focus shows one line: "Online", "Last seen 2 days ago" or "Never
 * seen"; the relative time is taken when the tooltip opens, so it never goes stale on a page left open. The
 * accessible name states the same with the exact time, so the state never rests on colour alone. The legacy display
 * draws `legacyIcon` instead.
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
  // When the tooltip last opened. Its text is relative to this, never to a clock read during render: a render-time
  // clock would be memoized on `lastSeen` (the React Compiler runs over this library in the app), so "1 minute ago"
  // would stay on screen for as long as the row does.
  const [openedAt, setOpenedAt] = useState(0);
  if (display === 'legacy') return <>{legacyIcon}</>;
  if (loading) return <MediaSkeleton.Icon size="sm" className={cn('shrink-0', className)} />;
  const { online } = getDeviceConnectivityConfig(connectivity);
  const state = connectivityState(connectivity, online);
  const seen = readableLastSeen(lastSeen);
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip
        onOpenChange={open => {
          if (open) setOpenedAt(Date.now());
        }}
      >
        <TooltipTrigger asChild>
          <span
            role="img"
            // Focusable, so a keyboard opens the tooltip as hover does.
            tabIndex={0}
            aria-label={accessibleName(state, seen)}
            data-connectivity={state}
            className={cn(
              'inline-flex shrink-0 rounded-sm text-ods-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus',
              className,
            )}
          >
            {state === 'online' ? (
              <DeviceOnlineIcon size={size} aria-hidden />
            ) : (
              <DeviceOfflineIcon
                size={size}
                aria-hidden
                // Offline is red; never reported keeps the icon's own grey (a grey "unknown" dot, as designed).
                secondaryColor={state === 'offline' ? 'var(--color-error)' : undefined}
              />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-ods-text-primary">{tooltipText(state, seen, openedAt)}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

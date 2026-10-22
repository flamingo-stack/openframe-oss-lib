'use client';

import { MonitorIcon } from '../../icons-v2-generated';
import { MediaSkeleton } from '../../loading/unified-skeleton';
import { useLoadingScope } from '../../ui/loading-scope';
import { renderDeviceTypeIcon } from './device-type-icon';

const ICON_CLASS = 'size-4 text-ods-text-secondary';

/**
 * A device's type icon in its 32px tile, the leading mark of every row that
 * names a device. Card-filled, so it keeps its edge on any row ground; an
 * unknown type draws the monitor rather than an empty tile.
 */
export function DeviceTypeTile({ type }: { type: string | null | undefined }) {
  // While the device is read the tile keeps its frame and its icon is a bar.
  const loading = useLoadingScope();
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-[6px] border border-ods-border bg-ods-card">
      {loading ? (
        <MediaSkeleton.Icon size="sm" />
      ) : (
        (renderDeviceTypeIcon(type ?? undefined, ICON_CLASS) ?? <MonitorIcon className={ICON_CLASS} />)
      )}
    </span>
  );
}

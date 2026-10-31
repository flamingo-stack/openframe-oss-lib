'use client';

import { useLoadingScope } from '../../ui/loading-scope';
import { Tag } from '../../ui/tag';
import { TruncateText } from '../../ui/truncate-text';
import { accessStateTag, formatLastRead } from './tenant-presentation';

export interface TenantAccessCellProps {
  accessState: string;
  lastReadAt?: string | null;
  /** A person paused the sync: said instead of the last read. */
  syncPaused?: boolean;
  /** The clock "Last read" is relative to. Default: the moment of the render. */
  now?: Date;
}

/** ACCESS column: the access tag over "Last read: ..." or "Sync paused"; a phone keeps the tag alone (Figma 3033-9343). */
export function TenantAccessCell({ accessState, lastReadAt, syncPaused = false, now }: TenantAccessCellProps) {
  // While the tenant is read (a loading scope) the access tag and its last read are their loading forms.
  const loading = useLoadingScope();
  const line = syncPaused ? 'Sync paused' : lastReadAt ? `Last read: ${formatLastRead(lastReadAt, now)}` : null;
  return (
    <div className="flex min-w-0 flex-col justify-center gap-[var(--spacing-system-xxs)]">
      <Tag {...accessStateTag(accessState)} loading={loading} className="self-start" />
      {(loading || line) && (
        <div className="hidden min-w-0 content-md:block">
          <TruncateText variant="h6" tone="secondary" loading={loading}>
            {line ?? ''}
          </TruncateText>
        </div>
      )}
    </div>
  );
}

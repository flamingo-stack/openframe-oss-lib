'use client';

import { useLoadingScope } from '../../ui/loading-scope';
import { Tag } from '../../ui/tag';
import { TruncateText } from '../../ui/truncate-text';
import { accessStateTag, formatLastRead } from './tenant-presentation';

export interface TenantAccessCellProps {
  accessState: string;
  lastReadAt?: string | null;
  /** The clock "Last read" is relative to. Default: the moment of the render. */
  now?: Date;
}

/** ACCESS column: the access tag over "Last read: ...". */
export function TenantAccessCell({ accessState, lastReadAt, now }: TenantAccessCellProps) {
  // While the tenant is read (a loading scope) the access tag and its last read are their loading forms.
  const loading = useLoadingScope();
  return (
    <div className="flex min-w-0 flex-col justify-center gap-[var(--spacing-system-xxs)]">
      <Tag {...accessStateTag(accessState)} loading={loading} className="self-start" />
      <TruncateText variant="h6" tone="secondary" loading={loading}>
        {`Last read: ${formatLastRead(lastReadAt, now)}`}
      </TruncateText>
    </div>
  );
}

'use client';

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
  return (
    <div className="flex min-w-0 flex-col justify-center gap-[var(--spacing-system-xxs)]">
      <Tag {...accessStateTag(accessState)} className="self-start" />
      <TruncateText variant="h6" tone="secondary">
        {`Last read: ${formatLastRead(lastReadAt, now)}`}
      </TruncateText>
    </div>
  );
}

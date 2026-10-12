'use client';

import { SquareAvatar } from '../../ui/square-avatar';
import { TruncateText } from '../../ui/truncate-text';
import { usersCountLabel } from './tenant-presentation';

export interface TenantCustomerCellProps {
  name: string;
  /** A URL the browser can load as is. */
  imageUrl?: string | null;
  userCount?: number | null;
}

/** CUSTOMERS column: customer logo + name over the synced user count. */
export function TenantCustomerCell({ name, imageUrl, userCount }: TenantCustomerCellProps) {
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
        <SquareAvatar src={imageUrl ?? undefined} alt={name} fallback={name} size="xs" variant="square" />
        <TruncateText>{name}</TruncateText>
      </div>
      <TruncateText variant="h6" tone="secondary">
        {usersCountLabel(userCount)}
      </TruncateText>
    </div>
  );
}

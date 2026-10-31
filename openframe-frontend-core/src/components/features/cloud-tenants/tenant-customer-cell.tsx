'use client';

import { useLoadingScope } from '../../ui/loading-scope';
import { SquareAvatar } from '../../ui/square-avatar';
import { TruncateText } from '../../ui/truncate-text';
import { TENANT_EMPTY_VALUE, unattributedLabel, usersCountLabel } from './tenant-presentation';
import type { TenantCustomer } from './tenant-row';

export interface TenantCustomerCellProps {
  /** In the host's order: the cell names the first and counts the rest. */
  customers: readonly TenantCustomer[];
  userCount?: number | null;
  /** Users no customer's rule claims: while there are any, the count line says how many, in the warning colour. */
  unattributedUserCount?: number | null;
  /** Nothing has been read from this directory yet: the count line says so. */
  neverRead?: boolean;
}

/**
 * CUSTOMERS column: the first customer's logo + name and "+N" for the rest, over the synced user count — or
 * "30 of 412 unattributed" while some users belong to no customer, or "Never read" before the first read.
 */
export function TenantCustomerCell({
  customers,
  userCount,
  unattributedUserCount,
  neverRead = false,
}: TenantCustomerCellProps) {
  // While the tenant is read (a loading scope) the user count is a bar too (its label is never empty).
  const loading = useLoadingScope();
  const [first] = customers;
  const more = customers.length - 1;
  const unattributed = unattributedLabel(unattributedUserCount, userCount);
  return (
    <div className="flex min-w-0 flex-col justify-center">
      {first ? (
        <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
          <SquareAvatar
            src={first.imageUrl ?? undefined}
            alt={first.name}
            fallback={first.name}
            size="xs"
            variant="square"
          />
          <TruncateText>{first.name}</TruncateText>
          {more > 0 && (
            <span className="shrink-0 text-ods-text-secondary text-h4">
              +{more}
              <span className="sr-only">{more === 1 ? ' more customer' : ' more customers'}</span>
            </span>
          )}
        </div>
      ) : (
        <TruncateText>{TENANT_EMPTY_VALUE}</TruncateText>
      )}
      <TruncateText
        variant="h6"
        tone="secondary"
        loading={loading}
        className={unattributed ? 'text-ods-warning' : undefined}
      >
        {unattributed ?? (neverRead ? 'Never read' : usersCountLabel(userCount))}
      </TruncateText>
    </div>
  );
}

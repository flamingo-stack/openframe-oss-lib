'use client';

import { useLoadingScope } from '../../ui/loading-scope';
import { SquareAvatar } from '../../ui/square-avatar';
import { TruncateText } from '../../ui/truncate-text';
import { TENANT_EMPTY_VALUE, usersCountLabel } from './tenant-presentation';
import type { TenantCustomer } from './tenant-row';

export interface TenantCustomerCellProps {
  /** Earliest attached first: the cell names the first and counts the rest. */
  customers: readonly TenantCustomer[];
  userCount?: number | null;
}

/** CUSTOMERS column: the first customer's logo + name and "+N" for the rest, over the synced user count. */
export function TenantCustomerCell({ customers, userCount }: TenantCustomerCellProps) {
  // While the tenant is read (a loading scope) the user count is a bar too (its label is never empty).
  const loading = useLoadingScope();
  const [first] = customers;
  const more = customers.length - 1;
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
          {more > 0 && <span className="shrink-0 text-ods-text-secondary text-h4">+{more}</span>}
        </div>
      ) : (
        <TruncateText>{TENANT_EMPTY_VALUE}</TruncateText>
      )}
      <TruncateText variant="h6" tone="secondary" loading={loading}>
        {usersCountLabel(userCount)}
      </TruncateText>
    </div>
  );
}

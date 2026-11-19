'use client';

// The tenants list's cells in the grid layout: ONE 48px line each. The card cells beside them (`tenant-cell.tsx` and
// the others) keep their two lines; what a card cell says on its second line sits here after the first, as the grid
// cell's secondary text.

import { MediaSkeleton } from '../../loading/unified-skeleton';
import { DataTable } from '../../ui/data-table';
import { useLoadingScope } from '../../ui/loading-scope';
import { Tag } from '../../ui/tag';
import { GridTextWithDetailCell } from '../feature-table-grid-cells';
import {
  accessStateTag,
  formatLastRead,
  licenseSummaryLines,
  lowercaseUsersCountLabel,
  providerMark,
  TENANT_EMPTY_VALUE,
  unattributedLabel,
  usersCountLabel,
} from './tenant-presentation';
import type { TenantCustomer, TenantLicenseSummary } from './tenant-row';

/** The provider's mark in a grid cell: the design's 20px leading icon. */
const GRID_PROVIDER_MARK_SIZE = 20;

/**
 * TENANT: the provider's mark, the name, the domain after it. A domain is as long as the name, so the name keeps its
 * width and the domain is the part cut (`GridTextWithDetailCell`), where `DataTable.Cell` would cut the name first.
 */
export function TenantGridCell({ provider, name, domain }: { provider: string; name: string; domain?: string | null }) {
  const { Logo, label } = providerMark(provider);
  // While the tenant is read (a loading scope) the mark is a box and the name a bar.
  const loading = useLoadingScope();
  return (
    <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xsf)]">
      <span data-part="leading" className="flex size-5 shrink-0 items-center justify-center">
        {loading ? (
          <MediaSkeleton.Icon size="sm" />
        ) : (
          <Logo size={GRID_PROVIDER_MARK_SIZE} role="img" aria-label={label} />
        )}
      </span>
      <GridTextWithDetailCell text={name} detail={domain ?? undefined} />
    </div>
  );
}

/**
 * CUSTOMERS of the multi-customer list: the first customer's logo and name, the rest behind `+N` (named on hover),
 * then the synced user count, "Never read" before the first read, or how many users no customer claims.
 */
export function TenantCustomersGridCell({
  customers,
  userCount,
  unattributedUserCount,
  neverRead = false,
}: {
  customers: readonly TenantCustomer[];
  userCount?: number | null;
  unattributedUserCount?: number | null;
  neverRead?: boolean;
}) {
  const loading = useLoadingScope();
  const [first, ...rest] = customers;
  const unattributed = unattributedLabel(unattributedUserCount, userCount);
  // While the tenant is read there is no count to print: the name's bar is the cell.
  const count = loading ? undefined : neverRead ? 'Never read' : lowercaseUsersCountLabel(userCount);
  return (
    <DataTable.Cell
      leading={first ? { type: 'image', src: first.imageUrl, alt: first.name } : undefined}
      text={first ? first.name : TENANT_EMPTY_VALUE}
      moreTags={rest.map(customer => customer.name)}
      // Users no customer claims are worth a look: the count is said in the warning colour, as on the card.
      secondary={unattributed ?? count}
      secondaryTone={unattributed ? 'warning' : 'secondary'}
    />
  );
}

/** CUSTOMERS of the single-customer list: the customer's logo and name, then the synced user count. */
export function TenantCustomerGridCell({
  name,
  imageUrl,
  userCount,
}: {
  name: string;
  imageUrl?: string | null;
  userCount?: number | null;
}) {
  const loading = useLoadingScope();
  return (
    <DataTable.Cell
      leading={{ type: 'image', src: imageUrl, alt: name }}
      text={name}
      secondary={loading ? undefined : usersCountLabel(userCount)}
    />
  );
}

/** LICENCES: assigned of purchased, then what is unused (in the warning colour when it is worth a look). */
export function TenantLicensesGridCell({ licenses }: { licenses?: TenantLicenseSummary | null }) {
  const loading = useLoadingScope();
  // While the tenant is read the cell is one bar: an empty text in a loading scope.
  if (loading) return <DataTable.Cell text="" />;
  const { value, detail, warning } = licenseSummaryLines(licenses);
  return (
    <DataTable.Cell text={value} secondary={detail ?? undefined} secondaryTone={warning ? 'warning' : 'secondary'} />
  );
}

/** ACCESS: the access tag, then "Last read: ..." or "Sync paused". */
export function TenantAccessGridCell({
  accessState,
  lastReadAt,
  syncPaused = false,
  alwaysLastRead = false,
  now,
}: {
  accessState: string;
  lastReadAt?: string | null;
  /** A person paused the sync: said instead of the last read. */
  syncPaused?: boolean;
  /** The single-customer list prints the last read of a tenant never read too ("Last read: —"). */
  alwaysLastRead?: boolean;
  now?: Date;
}) {
  // While the tenant is read the tag's own skeleton is the cell.
  const loading = useLoadingScope();
  const lastRead = lastReadAt || alwaysLastRead ? `Last read: ${formatLastRead(lastReadAt, now)}` : undefined;
  const line = syncPaused ? 'Sync paused' : lastRead;
  return (
    <DataTable.Cell
      tag={<Tag {...accessStateTag(accessState)} loading={loading} />}
      secondary={loading ? undefined : line}
    />
  );
}

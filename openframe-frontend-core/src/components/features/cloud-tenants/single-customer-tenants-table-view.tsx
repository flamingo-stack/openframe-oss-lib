'use client';

// Lib main's tenants list, one customer per tenant: `TenantsTableView`'s default variant, the list a host renders while
// tenant-management-v2 is off. Its markup is lib main's to the class; it is deleted with that variant.

import { useMemo } from 'react';
import { cn } from '../../../utils/cn';
import { openInNewTab } from '../../../utils/open-in-new-tab';
import { ArrowRightUpIcon } from '../../icons-v2-generated/arrows/arrow-right-up-icon';
import { Button } from '../../ui/button';
import { type ColumnDef, DataTable, dataTableLoadingRows, type Row, useDataTable } from '../../ui/data-table';
import { useLoadingScope } from '../../ui/loading-scope';
import { SquareAvatar } from '../../ui/square-avatar';
import { Tag } from '../../ui/tag';
import { TruncateText } from '../../ui/truncate-text';
import { TenantCell } from './tenant-cell';
import { accessStateTag, formatLastRead, usersCountLabel } from './tenant-presentation';
import type { TenantRow } from './tenant-row';
import type { TenantsTableColumn } from './tenants-table-columns';

/** Column layout of the single-customer list (Figma 1699-8249: Tenant, Customers, Access, open). */
const SINGLE_CUSTOMER_TENANT_COLUMNS = {
  tenant: { id: 'tenant', header: 'Tenant', width: 'flex-1 min-w-0' },
  customer: { id: 'customer', header: 'Customers', width: 'w-[220px] content-lg:w-[340px]', hideAt: 'md' },
  access: { id: 'access', header: 'Access', width: 'w-[200px] content-lg:w-[216px]' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
} satisfies Record<string, TenantsTableColumn>;

const getRowId = (row: TenantRow) => row.id;

const columnMeta = ({ width, hideAt, align }: TenantsTableColumn) => ({ width, hideAt, align });

/** A tenant still being read: a row the table keys, every field a cell shows empty (each draws its loading form). */
const loadingTenant = (id: string): TenantRow => ({
  id,
  name: '',
  provider: '',
  customer: { name: '' },
  accessState: '',
});

/** CUSTOMERS column: customer logo + name over the synced user count. */
function SingleCustomerTenantCustomerCell({
  name,
  imageUrl,
  userCount,
}: {
  name: string;
  imageUrl?: string | null;
  userCount?: number | null;
}) {
  // While the tenant is read (a loading scope) the user count is a bar too (its label is never empty).
  const loading = useLoadingScope();
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
        <SquareAvatar src={imageUrl ?? undefined} alt={name} fallback={name} size="xs" variant="square" />
        <TruncateText>{name}</TruncateText>
      </div>
      <TruncateText variant="h6" tone="secondary" loading={loading}>
        {usersCountLabel(userCount)}
      </TruncateText>
    </div>
  );
}

/** ACCESS column: the access tag over "Last read: ...". */
function SingleCustomerTenantAccessCell({
  accessState,
  lastReadAt,
  now,
}: {
  accessState: string;
  lastReadAt?: string | null;
  now?: Date;
}) {
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

/** The row's open-in-new-tab button: static chrome, drawn real and inert while the row is read. */
function OpenTenantButton({ href, name }: { href: string; name: string }) {
  const loading = useLoadingScope();
  return (
    // The row itself is the details link; a nested `<a>` is invalid, so this opens the same href.
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <Button
        onClick={loading ? undefined : openInNewTab(href)}
        disabled={loading}
        variant="outline"
        size="icon"
        leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
        aria-label={`Open ${name} in new tab`}
        className="bg-ods-card"
      />
    </div>
  );
}

export interface SingleCustomerTenantsTableViewProps {
  /** The default: one customer per tenant, no licences and no funnels. */
  variant?: 'single-customer';
  rows: TenantRow[];
  /** Where a row leads: the row is a link to it, and its last cell opens it in a new tab. */
  getHref: (row: TenantRow) => string;
  /** The search the rows answer; named by the "no match" message. */
  search?: string;
  /** Funnels belong to the multi-customer list. */
  filters?: never;
  /** The rows on screen are the previous result of a search still loading: they dim. */
  isPending?: boolean;
  /** All matching tenants, loaded or not. Default: the rows given. */
  totalCount?: number;
  stickyHeaderOffset?: string;
  skeletonRows?: number;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  /** The clock "Last read" is relative to. Default: the moment of the render. */
  now?: Date;
}

/** The rows a loading tenants table draws when the host states none (a typical page of tenants). */
const TENANTS_TABLE_SKELETON_ROWS = 20;

/** The tenants list: tenant, customer, access state and a way into each tenant's details. */
export function SingleCustomerTenantsTableView({
  rows,
  getHref,
  search = '',
  isPending = false,
  totalCount,
  stickyHeaderOffset,
  skeletonRows = TENANTS_TABLE_SKELETON_ROWS,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  now,
}: SingleCustomerTenantsTableViewProps) {
  const columns = useMemo<ColumnDef<TenantRow>[]>(
    () => [
      {
        id: SINGLE_CUSTOMER_TENANT_COLUMNS.tenant.id,
        header: SINGLE_CUSTOMER_TENANT_COLUMNS.tenant.header,
        cell: ({ row }: { row: Row<TenantRow> }) => (
          <TenantCell provider={row.original.provider} name={row.original.name} domain={row.original.domain} />
        ),
        enableSorting: false,
        meta: columnMeta(SINGLE_CUSTOMER_TENANT_COLUMNS.tenant),
      },
      {
        id: SINGLE_CUSTOMER_TENANT_COLUMNS.customer.id,
        header: SINGLE_CUSTOMER_TENANT_COLUMNS.customer.header,
        cell: ({ row }: { row: Row<TenantRow> }) => (
          <SingleCustomerTenantCustomerCell
            name={row.original.customer.name}
            imageUrl={row.original.customer.imageUrl}
            userCount={row.original.userCount}
          />
        ),
        enableSorting: false,
        meta: columnMeta(SINGLE_CUSTOMER_TENANT_COLUMNS.customer),
      },
      {
        id: SINGLE_CUSTOMER_TENANT_COLUMNS.access.id,
        header: SINGLE_CUSTOMER_TENANT_COLUMNS.access.header,
        cell: ({ row }: { row: Row<TenantRow> }) => (
          <SingleCustomerTenantAccessCell
            accessState={row.original.accessState}
            lastReadAt={row.original.lastReadAt}
            now={now}
          />
        ),
        enableSorting: false,
        meta: columnMeta(SINGLE_CUSTOMER_TENANT_COLUMNS.access),
      },
      {
        id: SINGLE_CUSTOMER_TENANT_COLUMNS.open.id,
        cell: ({ row }: { row: Row<TenantRow> }) => (
          <OpenTenantButton href={getHref(row.original)} name={row.original.name} />
        ),
        enableSorting: false,
        meta: columnMeta(SINGLE_CUSTOMER_TENANT_COLUMNS.open),
      },
    ],
    [getHref, now],
  );

  // A page's loading scope: the table holds one page of placeholder rows, drawn with the real cells (`loadingCells`).
  const loading = useLoadingScope();
  const loadingRows = useMemo(
    () => (loading ? dataTableLoadingRows(skeletonRows, loadingTenant) : null),
    [loading, skeletonRows],
  );
  const table = useDataTable<TenantRow>({ data: loadingRows ?? rows, columns, getRowId, enableSorting: false });

  return (
    // Dim, don't unmount, the stale rows while a deferred search refetches.
    <div className={cn('transition-opacity duration-200', isPending && 'opacity-60')}>
      <DataTable table={table}>
        <DataTable.Header
          stickyHeader={stickyHeaderOffset !== undefined}
          stickyHeaderOffset={stickyHeaderOffset}
          rightSlot={<DataTable.RowCount itemName="result" totalCount={totalCount ?? rows.length} loading={loading} />}
        />
        <DataTable.Body
          loadingCells
          skeletonRows={skeletonRows}
          emptyState={{
            title: 'No tenants match',
            description: `Nothing matches "${search}". Try a different name, domain or customer.`,
          }}
          rowClassName="mb-[var(--spacing-system-xxs)]"
          rowHref={getHref}
        />
        {rows.length > 0 && onLoadMore && (
          <DataTable.InfiniteFooter
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={onLoadMore}
          />
        )}
      </DataTable>
    </div>
  );
}

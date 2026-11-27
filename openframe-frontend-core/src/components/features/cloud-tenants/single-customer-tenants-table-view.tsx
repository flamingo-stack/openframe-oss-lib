'use client';

// Lib main's tenants list, one customer per tenant: `TenantsTableView`'s default variant, the list a host renders while
// tenant-management-v2 is off. Its markup is lib main's to the class; it is deleted with that variant.

import { useMemo } from 'react';
import { cn } from '../../../utils/cn';
import { openInNewTab } from '../../../utils/open-in-new-tab';
import { ArrowRightUpIcon } from '../../icons-v2-generated/arrows/arrow-right-up-icon';
import { Button } from '../../ui/button';
import {
  type ColumnDef,
  DataTable,
  dataTableLoadingRows,
  GRID_ACTION_COLUMN_SIZE,
  GRID_MIN_WIDTH,
  type Row,
  type TableMetaRow,
  tableMetaRowLayout,
  useDataTable,
} from '../../ui/data-table';
import { useLoadingScope } from '../../ui/loading-scope';
import { SquareAvatar } from '../../ui/square-avatar';
import { Tag } from '../../ui/tag';
import { TruncateText } from '../../ui/truncate-text';
import { GRID_ACTION_BUTTON_CLASS } from '../feature-table-grid-cells';
import { dataTableLayoutProps, type FeatureTableLayoutProps } from '../feature-table-layout';
import { TenantCell } from './tenant-cell';
import { TenantAccessGridCell, TenantCustomerGridCell, TenantGridCell } from './tenant-grid-cells';
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
function OpenTenantButton({ href, name, grid = false }: { href: string; name: string; grid?: boolean }) {
  const loading = useLoadingScope();
  return (
    // The row itself is the details link; a nested `<a>` is invalid, so this opens the same href.
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <Button
        onClick={loading ? undefined : openInNewTab(href)}
        disabled={loading}
        // In the grid the action is a bare 40px icon button: the cell is its frame.
        variant={grid ? 'transparent' : 'outline'}
        size="icon"
        leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
        aria-label={`Open ${name} in new tab`}
        className={grid ? GRID_ACTION_BUTTON_CLASS : 'bg-ods-card'}
      />
    </div>
  );
}

export interface SingleCustomerTenantsTableViewProps extends FeatureTableLayoutProps {
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
  /**
   * The row above the table. A paged list passes its `pager` (`useCursorPager` `footerProps`: First · Previous · Next,
   * with the range "21–40 of 120 results"), which replaces the load-more footer; a list that refetches its page passes
   * the auto-refresh picker as `actions`. The pager waits while `isPending` on its own.
   */
  metaRow?: TableMetaRow;
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
  metaRow: metaRowGiven,
  now,
  layout = 'cards',
  tableMaxHeight,
  tableSettings,
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
        // What the grid layout reads beside the card layout's `meta.width`: a `size`, a `minSize`, a one-line
        // `gridCell` and a `label` for the settings menu.
        size: 320,
        minSize: GRID_MIN_WIDTH.icon,
        meta: {
          ...columnMeta(SINGLE_CUSTOMER_TENANT_COLUMNS.tenant),
          label: 'Tenant',
          gridCell: ({ row }) => (
            <TenantGridCell provider={row.original.provider} name={row.original.name} domain={row.original.domain} />
          ),
        },
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
        size: 300,
        minSize: GRID_MIN_WIDTH.media,
        meta: {
          ...columnMeta(SINGLE_CUSTOMER_TENANT_COLUMNS.customer),
          label: 'Customers',
          gridCell: ({ row }) => (
            <TenantCustomerGridCell
              name={row.original.customer.name}
              imageUrl={row.original.customer.imageUrl}
              userCount={row.original.userCount}
            />
          ),
        },
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
        size: 260,
        meta: {
          ...columnMeta(SINGLE_CUSTOMER_TENANT_COLUMNS.access),
          label: 'Access',
          gridCell: ({ row }) => (
            <TenantAccessGridCell
              accessState={row.original.accessState}
              lastReadAt={row.original.lastReadAt}
              alwaysLastRead
              now={now}
            />
          ),
        },
      },
      {
        id: SINGLE_CUSTOMER_TENANT_COLUMNS.open.id,
        cell: ({ row }: { row: Row<TenantRow> }) => (
          <OpenTenantButton href={getHref(row.original)} name={row.original.name} />
        ),
        enableSorting: false,
        // An action column of the grid, kept by hand: `actionColumn()` would drop the card layout's `hideAt`.
        size: GRID_ACTION_COLUMN_SIZE,
        meta: {
          ...columnMeta(SINGLE_CUSTOMER_TENANT_COLUMNS.open),
          gridKind: 'action',
          gridCell: ({ row }) => <OpenTenantButton href={getHref(row.original)} name={row.original.name} grid />,
        },
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

  const rowCount = <DataTable.RowCount itemName="result" totalCount={totalCount ?? rows.length} loading={loading} />;
  // While the next page is read the rows on screen are the last page's: the pager's buttons wait (the range stays).
  const metaRow = metaRowGiven && { ...metaRowGiven, loading: !!metaRowGiven.loading || isPending };
  const { paged, drawn } = tableMetaRowLayout(metaRow, { rowCount: rows.length, loading, grid: layout === 'grid' });

  return (
    // Dim, don't unmount, the stale rows while a deferred search refetches.
    <div className={cn('transition-opacity duration-200', isPending && 'opacity-60')}>
      <DataTable table={table} {...dataTableLayoutProps({ layout, tableMaxHeight, tableSettings })}>
        {/* The row above the table: the grid's results count (the card header carries its own in `rightSlot`), or on a
            paged list the page's range with the pager, and the host's controls. */}
        {drawn && (
          <DataTable.MetaRow
            metaRow={metaRow}
            paged={paged}
            totalCount={totalCount}
            loading={loading}
            count={rowCount}
          />
        )}
        <DataTable.Header
          stickyHeader={stickyHeaderOffset !== undefined}
          stickyHeaderOffset={stickyHeaderOffset}
          rightSlot={drawn ? undefined : rowCount}
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
        {!paged && rows.length > 0 && onLoadMore && (
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

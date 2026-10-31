'use client';

import { useMemo } from 'react';
import { cn } from '../../../utils/cn';
import { openInNewTab } from '../../../utils/open-in-new-tab';
import { ArrowRightUpIcon } from '../../icons-v2-generated/arrows/arrow-right-up-icon';
import { Button } from '../../ui/button';
import {
  type ColumnDef,
  type ColumnFiltersState,
  DataTable,
  type DataTableFilterOption,
  dataTableLoadingRows,
  type Row,
  useDataTable,
} from '../../ui/data-table';
import { useLoadingScope } from '../../ui/loading-scope';
import { TenantAccessCell } from './tenant-access-cell';
import { TenantCell } from './tenant-cell';
import { TenantCustomerCell } from './tenant-customer-cell';
import { TenantLicensesCell } from './tenant-licenses-cell';
import type { TenantRow } from './tenant-row';
import { TENANT_COLUMNS, type TenantsTableColumn } from './tenants-table-columns';

const getRowId = (row: TenantRow) => row.id;

const columnMeta = ({ width, hideAt, align }: TenantsTableColumn) => ({ width, hideAt, align });

/** A tenant still being read: a row the table keys, every field a cell shows empty (each draws its loading form). */
const loadingTenant = (id: string): TenantRow => ({
  id,
  name: '',
  provider: '',
  customers: [{ name: '' }],
  accessState: '',
});

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

/** The columns whose header carries a funnel (Figma 3036-4860). */
export const TENANTS_TABLE_FILTER_COLUMNS = ['tenant', 'customer', 'licenses', 'access'] as const;

export type TenantsTableFilterColumn = (typeof TENANTS_TABLE_FILTER_COLUMNS)[number];

/** Each column's funnel: what it offers, what is ticked. The host narrows the rows; the view only draws. */
export interface TenantsTableFilters {
  /** A column with no options has no funnel. */
  options: Partial<Record<TenantsTableFilterColumn, DataTableFilterOption[]>>;
  selections: Readonly<Record<TenantsTableFilterColumn, readonly string[]>>;
  onChange: (next: Record<TenantsTableFilterColumn, string[]>) => void;
  /** The options are in flight: the funnels draw, inert. */
  pending?: boolean;
}

/**
 * Click handler that opens `href` in a new tab. The row is itself the details
 * link and an `<a>` cannot be nested in an `<a>`, so the button opens it by script.
 */
export interface TenantsTableViewProps {
  rows: TenantRow[];
  /** Where a row leads: the row is a link to it, and its last cell opens it in a new tab. */
  getHref: (row: TenantRow) => string;
  /** The search the rows answer; named by the "no match" message. */
  search?: string;
  /** The funnels of the column headers. Absent: none, as on the product page. */
  filters?: TenantsTableFilters;
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

/** The tenants list: tenant, customers, licences, access state and a way into each tenant's details. */
export function TenantsTableView({
  rows,
  getHref,
  search = '',
  filters,
  isPending = false,
  totalCount,
  stickyHeaderOffset,
  skeletonRows = TENANTS_TABLE_SKELETON_ROWS,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  now,
}: TenantsTableViewProps) {
  const filterOptions = filters?.options;
  const filtersPending = filters?.pending ?? false;
  const columns = useMemo<ColumnDef<TenantRow>[]>(() => {
    /** A column's funnel, while the host offers one. */
    const funnel = (id: TenantsTableFilterColumn) => {
      const options = filterOptions?.[id];
      return options && (options.length > 0 || filtersPending) ? { filter: { options, pending: filtersPending } } : {};
    };
    return [
      {
        id: TENANT_COLUMNS.tenant.id,
        header: TENANT_COLUMNS.tenant.header,
        cell: ({ row }: { row: Row<TenantRow> }) => (
          <TenantCell provider={row.original.provider} name={row.original.name} domain={row.original.domain} />
        ),
        enableSorting: false,
        meta: { ...columnMeta(TENANT_COLUMNS.tenant), ...funnel('tenant') },
      },
      {
        id: TENANT_COLUMNS.customer.id,
        header: TENANT_COLUMNS.customer.header,
        cell: ({ row }: { row: Row<TenantRow> }) => (
          <TenantCustomerCell
            customers={row.original.customers}
            userCount={row.original.userCount}
            unattributedUserCount={row.original.unattributedUserCount}
            neverRead={row.original.lastReadAt == null && row.original.userCount == null}
          />
        ),
        enableSorting: false,
        meta: { ...columnMeta(TENANT_COLUMNS.customer), ...funnel('customer') },
      },
      {
        id: TENANT_COLUMNS.licenses.id,
        header: TENANT_COLUMNS.licenses.header,
        cell: ({ row }: { row: Row<TenantRow> }) => <TenantLicensesCell licenses={row.original.licenses} />,
        enableSorting: false,
        meta: { ...columnMeta(TENANT_COLUMNS.licenses), ...funnel('licenses') },
      },
      {
        id: TENANT_COLUMNS.access.id,
        header: TENANT_COLUMNS.access.header,
        cell: ({ row }: { row: Row<TenantRow> }) => (
          <TenantAccessCell
            accessState={row.original.accessState}
            lastReadAt={row.original.lastReadAt}
            syncPaused={row.original.syncPaused}
            now={now}
          />
        ),
        enableSorting: false,
        meta: { ...columnMeta(TENANT_COLUMNS.access), ...funnel('access') },
      },
      {
        id: TENANT_COLUMNS.open.id,
        cell: ({ row }: { row: Row<TenantRow> }) => (
          <OpenTenantButton href={getHref(row.original)} name={row.original.name} />
        ),
        enableSorting: false,
        meta: columnMeta(TENANT_COLUMNS.open),
      },
    ];
  }, [getHref, now, filterOptions, filtersPending]);

  // A page's loading scope: the table holds one page of placeholder rows, drawn with the real cells (`loadingCells`).
  const loading = useLoadingScope();
  const loadingRows = useMemo(
    () => (loading ? dataTableLoadingRows(skeletonRows, loadingTenant) : null),
    [loading, skeletonRows],
  );
  const selections = filters?.selections;
  const onFiltersChange = filters?.onChange;
  const columnFilters = useMemo<ColumnFiltersState>(
    () =>
      TENANTS_TABLE_FILTER_COLUMNS.flatMap(id =>
        selections && selections[id].length > 0 ? [{ id, value: selections[id] }] : [],
      ),
    [selections],
  );
  const table = useDataTable<TenantRow>({
    data: loadingRows ?? rows,
    columns,
    getRowId,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange: updater => {
      const next = typeof updater === 'function' ? updater(columnFilters) : updater;
      const picked = (id: TenantsTableFilterColumn) => {
        const value = next.find(filter => filter.id === id)?.value;
        return Array.isArray(value) ? (value as string[]) : [];
      };
      onFiltersChange?.({
        tenant: picked('tenant'),
        customer: picked('customer'),
        licenses: picked('licenses'),
        access: picked('access'),
      });
    },
  });

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
            description: search
              ? `Nothing matches "${search}". Try a different name, domain or customer.`
              : 'Nothing matches the selected filters. Try adjusting them.',
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

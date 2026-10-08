/** Layout of one column of the tenants list: what the live table and a skeleton of it both read. */
export interface TenantsTableColumn {
  id: string;
  header?: string;
  /** The column's `meta.width` class. */
  width: string;
  hideAt?: 'md' | 'lg' | 'xl' | '2xl';
  align?: 'right';
}

/**
 * Column layout of the tenants list (Figma 1699-8249: Tenant, Customers,
 * Access, open). Data-only on purpose: the live table and the route skeleton
 * read the SAME widths, so nothing shifts when the rows arrive, and a skeleton
 * never imports the table's cell renderers.
 */
export const TENANT_COLUMNS = {
  tenant: { id: 'tenant', header: 'Tenant', width: 'flex-1 min-w-0' },
  customer: { id: 'customer', header: 'Customers', width: 'w-[220px] content-lg:w-[340px]', hideAt: 'md' },
  access: { id: 'access', header: 'Access', width: 'w-[200px] content-lg:w-[216px]' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
} satisfies Record<string, TenantsTableColumn>;

/** Render order of the standalone list. */
export const TENANTS_TABLE_COLUMNS: readonly TenantsTableColumn[] = [
  TENANT_COLUMNS.tenant,
  TENANT_COLUMNS.customer,
  TENANT_COLUMNS.access,
  TENANT_COLUMNS.open,
];

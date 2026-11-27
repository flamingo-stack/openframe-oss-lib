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
 * The tenant column of both lists: it takes what the other cells leave, and never less than 5rem (the provider's mark
 * and the start of the name). `flex-1` alone has a zero basis, so beside a cell that keeps its width it shrank to 0px
 * and a phone's row showed no tenant at all.
 */
export const TENANT_COLUMN_WIDTH = 'flex-1 min-w-[5rem]';

/**
 * Column layout of the tenants list (Figma 3025-3536: Tenant, Customers, Licences, Access, open). A tablet drops the
 * licence cells and keeps the funnel (3032-4579); a phone keeps the tenant, the access tag and open (3033-9343). On a
 * phone the access column is its tag's width and gives way to the tenant's floor (the tag's label ends in "…").
 * Data-only on purpose: the live table and the route skeleton
 * read the SAME widths, so nothing shifts when the rows arrive, and a skeleton
 * never imports the table's cell renderers.
 */
export const TENANT_COLUMNS = {
  tenant: { id: 'tenant', header: 'Tenant', width: TENANT_COLUMN_WIDTH },
  customer: { id: 'customer', header: 'Customers', width: 'w-[220px] content-lg:w-[280px]', hideAt: 'md' },
  licenses: { id: 'licenses', header: 'Licences', width: 'w-[150px]', hideAt: 'lg' },
  access: {
    id: 'access',
    header: 'Access',
    width: 'min-w-0 content-md:flex-none content-md:w-[200px] content-lg:w-[216px]',
  },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TenantsTableColumn>;

/** Render order of the standalone list. */
export const TENANTS_TABLE_COLUMNS: readonly TenantsTableColumn[] = [
  TENANT_COLUMNS.tenant,
  TENANT_COLUMNS.customer,
  TENANT_COLUMNS.licenses,
  TENANT_COLUMNS.access,
  TENANT_COLUMNS.open,
];

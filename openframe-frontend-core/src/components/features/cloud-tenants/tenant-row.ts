/** A customer a tenant's directory serves. */
export interface TenantCustomer {
  name: string;
  /** A URL the browser can load as is. */
  imageUrl?: string | null;
}

/** A directory's seats over its paid SKUs. */
export interface TenantLicenseSummary {
  assigned: number;
  /** Absent when the provider does not report purchased seats (Google Workspace). */
  purchased?: number | null;
  /** Purchased minus assigned; negative when the provider counts suspended seats as assigned. */
  unused?: number | null;
}

/** One connected directory tenant, as the tenants list shows it. */
export interface TenantRow {
  id: string;
  /** The tenant's own name in its directory. */
  name: string;
  /** The directory provider (`MICROSOFT_365`, `GOOGLE_WORKSPACE`); an unknown value keeps its raw name. */
  provider: string;
  domain?: string | null;
  /** The customers the directory serves, in the order the host shows them; empty while it serves none. */
  customers: readonly TenantCustomer[];
  /** Users read from the directory; absent before the first read. */
  userCount?: number | null;
  /** Of those, the users no customer's rule claims; absent before the first read. */
  unattributedUserCount?: number | null;
  /** What the last access probe found (`WRITE_ENABLED`, `DISCONNECTED`, ...). */
  accessState: string;
  /** When the directory was last read; absent when it never was. */
  lastReadAt?: string | null;
  /** A person paused the sync: the row says so instead of when it was last read. */
  syncPaused?: boolean;
  /** Absent until the licence numbers have been read. */
  licenses?: TenantLicenseSummary | null;
}

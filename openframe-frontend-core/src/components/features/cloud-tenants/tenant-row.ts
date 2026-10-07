/** One connected directory tenant, as the tenants list shows it. */
export interface TenantRow {
  id: string;
  /** The tenant's own name in its directory. */
  name: string;
  /** The directory provider (`MICROSOFT_365`, `GOOGLE_WORKSPACE`); an unknown value keeps its raw name. */
  provider: string;
  domain?: string | null;
  /** The customer the tenant belongs to. */
  customer: {
    name: string;
    /** A URL the browser can load as is. */
    imageUrl?: string | null;
  };
  /** Users read from the directory; absent before the first read. */
  userCount?: number | null;
  /** What the last access probe found (`WRITE_ENABLED`, `DISCONNECTED`, ...). */
  accessState: string;
  /** When the directory was last read; absent when it never was. */
  lastReadAt?: string | null;
}

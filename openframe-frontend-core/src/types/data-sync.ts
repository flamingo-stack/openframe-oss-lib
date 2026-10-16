/**
 * Every system a shared page's records are mirrored from, with the name a page shows for it. THE list: `DataSync`,
 * `DataSyncLine`'s marks, the docs hook and every host that answers a `sync` read it.
 */
export const DATA_SYNC_SOURCES = {
  clickup: 'ClickUp',
  hubspot: 'HubSpot',
  github: 'GitHub',
} as const;

export type DataSyncSource = keyof typeof DATA_SYNC_SOURCES;

export function isDataSyncSource(value: unknown): value is DataSyncSource {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(DATA_SYNC_SOURCES, value);
}

/**
 * Where a list's records are mirrored from and when that mirror last read them: the `sync` a shared page's
 * endpoint answers beside its records, drawn by `DataSyncLine`. Server-safe.
 */
export interface DataSync {
  /** The system the records are read from. */
  source: DataSyncSource;
  /** ISO instant of the mirror's last successful read, or null when it never ran. */
  syncedAt: string | null;
}

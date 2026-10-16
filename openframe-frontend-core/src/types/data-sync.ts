/**
 * Where a list's records are mirrored from and when that mirror last read them: the `sync` a shared page's
 * endpoint answers beside its records, drawn by `DataSyncLine`. Server-safe (type only).
 */
export interface DataSync {
  /** The system the records are read from: `clickup`, `hubspot` or `github` (an unknown one is shown by name). */
  source: 'clickup' | 'hubspot' | 'github' | (string & {});
  /** ISO instant of the mirror's last successful read, or null when it never ran. */
  syncedAt: string | null;
}

/**
 * Column widths of the logs table. Data-only, read by the live table and by
 * `LogsTableSkeleton`, so the header row cannot drift from the rows it stands in
 * for and a width is changed in one place.
 */
export const LOG_COLUMN_WIDTHS = {
  logId: 'w-[200px]',
  status: 'w-[120px]',
  // Sized for the widest badge, "Google Workspace": the 24px mark, its gap and the
  // text-h4 label, inside the cell's own padding, on one line.
  tool: 'w-[240px]',
  source: 'w-[120px]',
  description: 'flex-1',
  /** One icon button. */
  action: 'w-12 shrink-0 flex-none',
} as const;

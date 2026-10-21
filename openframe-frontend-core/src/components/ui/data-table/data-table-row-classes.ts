/**
 * THE table-row class set: the frame, heights and shells a data-table row is drawn with, loaded and loading. Read by
 * `DataTableRow` (both forms), the pad rows, the legacy `Table`'s skeleton, `TestRun` and the query-report table, so a
 * loading row and a loaded one are one box by construction.
 */

/**
 * Consistent INNER row heights. The row card wraps these in a 1px border on
 * each side, so the outer block lands on the designed 68px / 80px total —
 * hence the 66/78 values here.
 */
export const ROW_HEIGHT_DESKTOP = 'h-[66px] content-md:h-[78px]';
export const ROW_HEIGHT_MOBILE = 'h-[66px]';

/**
 * The row shell's inset and column gap.
 *
 * Shared by the real row (`data-table-row`), the skeleton rows below and the
 * pad rows in `data-table-body`, because a difference between them is a visible
 * shift on load — and there WAS one: all three placeholders used
 * `--spacing-system-sf` (12px) in their mobile variant while the real row uses
 * `--spacing-system-mf` (16px) at every width, so a loading table sat 4px closer
 * to the card edge than the loaded one and its content nudged over when data
 * arrived. Kept as a constant rather than three copies so that cannot drift again.
 */
export const ROW_SHELL_CLASSES = 'items-center gap-[var(--spacing-system-mf)] px-[var(--spacing-system-mf)]';

/**
 * The column every row slot stacks in, and the gap between two of them.
 *
 * One constant for the same reason as `ROW_SHELL_CLASSES`: the body's rows, its
 * loading skeleton and the infinite footer's fallback skeleton all stack here,
 * and the footer used to stack in nothing at all — its placeholder rows were
 * bare children of the table root, touching each other.
 */
/** A row's card (its frame and surface): read by `DataTableRow` and by the loading rows below, so both are one box. */
export const DATA_TABLE_ROW_FRAME_CLASS = 'overflow-hidden rounded-md border border-ods-border bg-ods-card';

export const ROW_STACK_CLASSES = 'flex w-full flex-col gap-[var(--spacing-system-xsf)]';

/**
 * THE table-row class set: the frame, heights and shells a data-table row is drawn with, loaded and loading. Read by
 * `DataTableRow` (both forms), the pad rows, `TestRun` and the query-report table, so a
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
/** A row slot's box (its corners and its 1px border), shared by a row's card and a pad row, so both are one height. */
const ROW_BOX_CLASS = 'overflow-hidden rounded-md border';
/** A row's card (its frame and surface): read by `DataTableRow` and by the loading rows below, so both are one box. */
export const DATA_TABLE_ROW_FRAME_CLASS = `${ROW_BOX_CLASS} border-ods-border bg-ods-card`;
/** A pad row (`PlaceholderRows`): the card's box with a transparent border, so it is the row's height and invisible. */
export const DATA_TABLE_PAD_ROW_FRAME_CLASS = `pointer-events-none relative ${ROW_BOX_CLASS} border-transparent`;

/** The row's desktop shell (its cells in columns, from md) and its mobile shell (one stacked cell, below md): read by the
 *  loading row and the pad rows, so a row's two layouts are one pair of boxes. */
export const ROW_DESKTOP_SHELL_CLASS = 'hidden content-md:flex';
export const ROW_MOBILE_SHELL_CLASS = 'flex justify-start content-md:hidden';

export const ROW_STACK_CLASSES = 'flex w-full flex-col gap-[var(--spacing-system-xsf)]';

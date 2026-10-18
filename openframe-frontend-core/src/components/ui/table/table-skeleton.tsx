'use client';

import { cn } from '../../../utils/cn';
import { InteractiveSkeleton, TextLineSkeleton, UnifiedSkeleton } from '../../loading/unified-skeleton';
import { CHECKBOX_BOX_CLASS } from '../checkbox';
import type { TableCardSkeletonProps } from './types';
import { getHideClasses, TABLE_ACTIONS_COLUMN_KEY, TABLE_CHEVRON_COLUMN_KEY } from './utils';

// INNER row heights: the bordered row card adds 1px top + bottom, so the
// outer block totals the designed 68px / 80px.
const ROW_HEIGHT_DESKTOP = 'h-[66px] content-md:h-[78px]';
/**
 * A `compact` row's floor. Compact rows are content-sized (`py-2`), but every
 * row in one table renders the same cell shapes, so pinning a minimum makes the
 * body's height a function of the ROW COUNT alone. Hosts do NOT reserve
 * `rows × 56` themselves any more: `skeletonRows` + `minRows` hold
 * a full page's height in every state (placeholders below), and a cell taller
 * than this floor (avatar + two lines) wants a non-compact, fixed-height row.
 */
const COMPACT_ROW_MIN_HEIGHT = 'min-h-[56px]';
const ROW_HEIGHT_MOBILE = 'h-[66px]';

/** @deprecated Use `DataTableSkeleton` from `data-table` instead. */
/**
 * Rows a table's skeleton draws when its host states no count: one screen of rows under a page's header (a 68px row
 * card and its 8px gap; about ten fit under the header of a 1440x900 screen, nine of a phone's 66px rows).
 */
export const TABLE_SKELETON_ROWS = 10;

export function TableCardSkeleton({
  columns,
  rows = TABLE_SKELETON_ROWS,
  compact = false,
  actions,
  selectable = false,
  className,
  rowClassName,
}: TableCardSkeletonProps) {
  // The multi-line placeholder belongs to the primary text column — the wide,
  // GROWING one (`flex-1` / `flex-[n]`), not necessarily the first column, which
  // may be a narrow leading action/icon column. Falls back to the first column.
  const primaryKey = (columns.find(c => /flex-(1|\[)/.test(c.width || '')) ?? columns[0])?.key;
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={cn('relative overflow-hidden rounded-[6px] border border-ods-border bg-ods-card', className)}
        >
          {/* `TableRow`'s own row: the same frame, gap and height at every breakpoint, each column in its own cell
              width (the synthetic actions and chevron columns included), so a loaded row takes the skeleton's place. */}
          <div
            className={cn(
              'relative flex items-center gap-4 px-4',
              compact ? cn('py-2', COMPACT_ROW_MIN_HEIGHT) : cn('py-0', ROW_HEIGHT_DESKTOP),
              rowClassName,
            )}
          >
            {selectable && (
              <div className="flex w-10 shrink-0 items-center justify-center">
                <UnifiedSkeleton className={CHECKBOX_BOX_CLASS} />
              </div>
            )}
            {columns.map(column => {
              const cellClass = cn('flex shrink-0', column.width || 'min-w-0 flex-1', getHideClasses(column.hideAt));
              if (column.key === TABLE_ACTIONS_COLUMN_KEY) {
                // One button per row action, at the real buttons' size: an icon-only action an icon button. A host
                // that renders its own actions (`renderRowActions`) gets one icon button in the column's width.
                return (
                  <div key={column.key} className={cn(cellClass, 'items-center justify-end gap-2')}>
                    {(actions ?? [{ iconOnly: true }]).map((action, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: skeleton buttons never reorder
                      <InteractiveSkeleton.Button key={i} size={action.iconOnly ? 'icon' : 'default'} />
                    ))}
                  </div>
                );
              }
              if (column.key === TABLE_CHEVRON_COLUMN_KEY) {
                return (
                  <div key={column.key} className={cn(cellClass, 'items-center justify-end')}>
                    <InteractiveSkeleton.Button size="icon" />
                  </div>
                );
              }
              return (
                <div key={column.key} className={cn(cellClass, 'flex-col justify-center overflow-hidden')}>
                  {/* A cell's text (`TableCell`: the primary face), and on the primary column every other row a
                      second, secondary line (a description or an id under it). */}
                  <TextLineSkeleton type="h4" className="w-3/4" />
                  {index % 2 === 0 && column.key === primaryKey && <TextLineSkeleton type="h6" className="w-1/2" />}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

/** @deprecated */
export { COMPACT_ROW_MIN_HEIGHT, ROW_HEIGHT_DESKTOP, ROW_HEIGHT_MOBILE };

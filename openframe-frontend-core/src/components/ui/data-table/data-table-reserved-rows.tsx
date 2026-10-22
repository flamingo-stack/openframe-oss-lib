'use client';

import type { ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import { LoadingItems } from '../loading-scope';
import {
  DATA_TABLE_PAD_ROW_FRAME_CLASS,
  ROW_DESKTOP_SHELL_CLASS,
  ROW_HEIGHT_DESKTOP,
  ROW_HEIGHT_MOBILE,
  ROW_MOBILE_SHELL_CLASS,
  ROW_SHELL_CLASSES,
} from './data-table-row-classes';

/**
 * The empty state, floating centred over a full page's worth of reserved row
 * slots. Both table bodies render this — an empty table is exactly when a
 * collapsing one is most visible (the pagination and everything under it jump
 * the moment a filter matches nothing), and two hand-matched copies of the
 * wrapper would drift the way the two placeholder components already had.
 */
export function ReservedEmptyState({
  count,
  gapClassName,
  rowHeightClassName,
  innerHeightClassName,
  children,
}: {
  count: number;
  gapClassName: string;
  rowHeightClassName?: string;
  innerHeightClassName?: string;
  children: ReactNode;
}) {
  // ONE grid cell holds both layers, so the box is as tall as the TALLER of
  // the two: a short reservation (three compact rows) never clips the empty
  // state, and a tall one still reserves its slots. The former absolute
  // overlay took no height of its own, so a message taller than the slots
  // spilled out of the host's horizontal scroller and grew it a vertical
  // scrollbar — the header scrolled away inside a section.
  return (
    <div className="grid w-full">
      <div className={cn('flex w-full flex-col [grid-area:1/1]', gapClassName)}>
        <PlaceholderRows
          count={count}
          rowHeightClassName={rowHeightClassName}
          innerHeightClassName={innerHeightClassName}
        />
      </div>
      {/* `sticky left-0` + `w-screen max-w-full`: hosts wrap tables in a
          horizontal scroller with a forced min-width, and an overlay centred on
          that CANVAS puts the message off-screen on a phone. This centres it on
          the visible area instead, and collapses to plain centring when the
          table is not wider than its container. */}
      <div className="flex items-center [grid-area:1/1]">
        <div className="sticky left-0 flex w-screen max-w-full justify-center">{children}</div>
      </div>
    </div>
  );
}

/**
 * Invisible rows that occupy exactly one row slot each.
 *
 * THE height reservation for a table whose page is short or empty — every call
 * site uses it (data-table's pad + empty branches AND the legacy `Table`'s), so
 * a padded page and an empty one are the same height by construction rather
 * than by matching guesses in each component.
 */
export function PlaceholderRows({
  count,
  rowHeightClassName,
  innerHeightClassName,
}: {
  count: number;
  /** Height on the CARD, as `DataTableRow` carries it. */
  rowHeightClassName?: string;
  /** Height on the INNER row instead — the legacy `Table` puts it there and
   *  lets the card's border add the remaining 2px, so its pad rows must too. */
  innerHeightClassName?: string;
}) {
  return (
    // loading-standard-ok(ITEM_MARK): pad slots that reserve a short page's height in the LOADED table, not items
    <LoadingItems count={count}>
      {() => (
        <div
          // `border-transparent`, not no border: a real row card draws a 1px
          // border on each side, so its outer block is the inner height PLUS 2.
          // A pad row without one is 2px shorter than the row it stands in for
          // — invisible per row, 54px over a 27-row remainder, which is the
          // same shift `minRows` exists to prevent.
          className={cn(
            DATA_TABLE_PAD_ROW_FRAME_CLASS,
            // The stated slot height belongs on the CARD, exactly as a real
            // row carries it — a real row with a sub-row is taller than its
            // cells, so reserving the cells' height here left every pad row
            // short by the sub-row.
            rowHeightClassName,
          )}
          aria-hidden="true"
        >
          <div
            className={cn(
              ROW_DESKTOP_SHELL_CLASS,
              'py-0',
              ROW_SHELL_CLASSES,
              innerHeightClassName ?? (rowHeightClassName ? 'h-full' : ROW_HEIGHT_DESKTOP),
            )}
          />
          <div
            className={cn(
              ROW_MOBILE_SHELL_CLASS,
              'py-0',
              ROW_SHELL_CLASSES,
              innerHeightClassName ?? (rowHeightClassName ? 'h-full' : ROW_HEIGHT_MOBILE),
            )}
          />
        </div>
      )}
    </LoadingItems>
  );
}

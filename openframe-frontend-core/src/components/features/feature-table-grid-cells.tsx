'use client';

import { TruncateText } from '../ui/truncate-text';

/**
 * The bare 40px icon button of a grid table's action cell (with `variant="transparent"`): the 56px cell is its frame,
 * where a card row draws the outlined button.
 */
export const GRID_ACTION_BUTTON_CLASS = 'size-10 border-0 md:size-10';

export interface GridTextWithDetailCellProps {
  /** The cell's subject (a name, a time): kept whole while the column has room for it. */
  text: string;
  /** What a card row prints on its second line (a description, an id): takes the width left, cut with an ellipsis. */
  detail?: string;
}

/**
 * A grid cell of a card row's two lines on one: the subject, then its detail in the secondary tone. The subject keeps
 * its width and the detail takes what is left, cut with an ellipsis and shown whole in a tooltip; only a column
 * narrower than the subject cuts the subject too.
 *
 * `DataTable.Cell` cuts the other way round (its main text gives way to the secondary one), which suits a short
 * secondary text ("1 hour ago") and not a description as long as the row.
 */
export function GridTextWithDetailCell({ text, detail }: GridTextWithDetailCellProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xsf)]">
      <TruncateText as="span">{text}</TruncateText>
      {detail ? (
        <TruncateText as="span" variant="h6" tone="secondary" triggerClassName="flex-1">
          {detail}
        </TruncateText>
      ) : null}
    </div>
  );
}

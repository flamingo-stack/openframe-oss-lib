'use client';

import type { CellContext, ColumnDef } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { Checkbox } from '../checkbox';

/** The width of a grid table's selection column, in px. */
export const GRID_UTILITY_COLUMN_SIZE = 48;
/** The width of one row-action column, in px: the 40px action button and 8px on each side of it. */
export const GRID_ACTION_COLUMN_SIZE = 56;

/**
 * The grid table's checkbox (the design's `table/utility-cell`, type checkbox): a 20px box with a 2px border, in the
 * row's body and in the header's "select all".
 */
export const GRID_CHECKBOX_CLASS = 'size-5 rounded-md border-2 border-ods-text-secondary';
/** Its checkmark, sized to the 20px box. */
export const GRID_CHECKBOX_INDICATOR_CLASS = 'size-3';

/**
 * The selection column of a grid table: a checkbox per row and "select all" in the header. Always drawn first and
 * pinned left, wherever it sits in `columns`. Selection lives in the table's `rowSelection` state.
 */
export function selectionColumn<T>({ id = 'select' }: { id?: string } = {}): ColumnDef<T> {
  return {
    id,
    size: GRID_UTILITY_COLUMN_SIZE,
    enableSorting: false,
    enableHiding: false,
    // `hideAt: 'md'`: the column belongs to the grid. The card rows the same table draws below `md` do not show it.
    meta: { gridKind: 'select', width: 'w-10 shrink-0 flex-none', hideAt: 'md' },
    cell: ({ row }) => (
      <Checkbox
        aria-label="Select row"
        className={GRID_CHECKBOX_CLASS}
        boxClassName={GRID_CHECKBOX_CLASS}
        indicatorClassName={GRID_CHECKBOX_INDICATOR_CLASS}
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onCheckedChange={checked => row.toggleSelected(checked)}
      />
    ),
  };
}

/**
 * A row-action column of a grid table (the "more" menu, the "open" link): one 56px column per action, a divider
 * between every two. Always drawn last and pinned right. Its cell never triggers the row's own click or link.
 */
export function actionColumn<T>({
  id,
  cell,
}: {
  id: string;
  cell: (context: CellContext<T, unknown>) => ReactNode;
}): ColumnDef<T> {
  return {
    id,
    size: GRID_ACTION_COLUMN_SIZE,
    enableSorting: false,
    enableHiding: false,
    meta: { gridKind: 'action', width: 'w-12 shrink-0 flex-none', align: 'right' },
    cell,
  };
}

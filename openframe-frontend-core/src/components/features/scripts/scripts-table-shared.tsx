'use client';

import type { ReactNode } from 'react';
import { openInNewTab } from '../../../utils/open-in-new-tab';
import { ArrowRightUpIcon } from '../../icons-v2-generated/arrows/arrow-right-up-icon';
import { Button } from '../../ui/button';
import { useLoadingScope } from '../../ui/loading-scope';
import { GRID_ACTION_BUTTON_CLASS } from '../feature-table-grid-cells';
import type { ScriptsTableColumnLayout } from './scripts-table-columns';

/**
 * A column's `meta` from its layout: the fields a live table and its skeleton agree on. `label` and `gridKind` are
 * the grid layout's (the column's name in the settings menu, a row action pinned right); the card rows read neither.
 */
export function scriptsColumnMeta(column: ScriptsTableColumnLayout) {
  return {
    width: column.width,
    hideAt: column.hideAt,
    align: column.align,
    sortable: column.sortable,
    alwaysShowHeader: column.dateFilterable,
    label: column.label,
    gridKind: column.gridKind,
  };
}

/**
 * A column's size in the grid layout, for its column definition: `size` and, where the layout states one, `minSize`.
 * The card rows read neither (their widths are the `meta.width` classes).
 */
export function scriptsColumnSize(column: ScriptsTableColumnLayout): { size: number; minSize?: number } {
  return column.minSize === undefined ? { size: column.size } : { size: column.size, minSize: column.minSize };
}

/** The row menu's cell: outside the row's own link. */
export function RowActionsCell({ children }: { children: ReactNode }) {
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end gap-2">
      {children}
    </div>
  );
}

/**
 * The last cell of a row: its page in a new tab. The row is a link itself, so this opens by script. While the row is
 * read (a loading scope) the button is static chrome: drawn real and inert. `grid`: the cell of a grid table, where
 * the action is a bare 40px icon button and the cell is its frame.
 */
export function OpenInNewTabCell({
  href,
  grid = false,
  label = 'Open in new tab',
}: {
  href: string;
  grid?: boolean;
  /** The button's accessible name, where a table says what opens ("Open run details in new tab"). */
  label?: string;
}) {
  const loading = useLoadingScope();
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <Button
        onClick={loading ? undefined : openInNewTab(href)}
        disabled={loading}
        variant={grid ? 'transparent' : 'outline'}
        size="icon"
        leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
        aria-label={label}
        className={grid ? GRID_ACTION_BUTTON_CLASS : 'bg-ods-card'}
      />
    </div>
  );
}

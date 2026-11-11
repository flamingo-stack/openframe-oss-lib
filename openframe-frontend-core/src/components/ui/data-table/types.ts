import type { CellContext, RowData } from '@tanstack/react-table';
import type { ReactNode } from 'react';

export type TailwindBreakpoint = 'md' | 'lg' | 'xl' | '2xl';

export interface DataTableFilterOption {
  id: string;
  label: string;
  value: string | number | boolean;
  /**
   * How many rows this option would match, rendered right-aligned beside the
   * label by `FiltersDropdown`. Optional: a list whose options come from a
   * plain enum rather than a server facet has no honest number to show, and
   * `undefined` draws nothing at all — which is the correct answer there.
   *
   * A facet is expected to be SELF-EXCLUDING (computed with every active
   * filter EXCEPT its own field), so the number reads "how many rows if you
   * pick this" and stays put as the user ticks options in the same dropdown.
   * A count narrowed by its own filter collapses every unpicked option to 0
   * the moment one is picked — do not feed one in.
   */
  count?: number;
}

/**
 * The options a filter UI has selected, per column: the option ids `FiltersDropdown` emits, keyed by column id. What
 * `FilterModal` and `ListPageLayout`'s mobile filters take and hand back.
 */
export interface DataTableFilters {
  [columnKey: string]: string[];
}

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Tailwind width class, e.g. `'w-40'`, `'flex-1 min-w-0'`. */
    width?: string;
    /** Horizontal alignment inside the cell/header. */
    align?: 'left' | 'center' | 'right';
    /** Hide column at/below these Tailwind breakpoints. */
    hideAt?: TailwindBreakpoint | TailwindBreakpoint[];
    /**
     * Keep this header visible on tablet (md, below lg) even without
     * `meta.filter` — for custom headers hosting their own filter UI
     * (e.g. the date filter calendar trigger).
     */
    alwaysShowHeader?: boolean;
    /**
     * If present, the column filters: the header cell survives on tablet and,
     * when there is something to choose from, renders the funnel + dropdown.
     *
     * An EMPTY `options` list draws no funnel at all — a control that cannot be
     * opened is worse than no control, and every table in the design shows the
     * bare label there. Set `pending` for the other empty case, "the options are
     * still loading": that one keeps the funnel, so it does not appear out of
     * nowhere the moment the query answers.
     */
    filter?: {
      options: DataTableFilterOption[];
      placement?: 'bottom-start' | 'bottom-end' | 'bottom';
      /** Options are in flight — draw the funnel, inert, instead of hiding it. */
      pending?: boolean;
    };
    /**
     * Opt-in: header renders the sort indicator and clicks toggle column sort.
     * Default `false` — columns are not sortable from the UI even though
     * TanStack's `enableSorting` defaults to true.
     */
    sortable?: boolean;
    /** Extra class names applied to the body cell wrapper. */
    cellClassName?: string;
    /** Extra class names applied to the header cell wrapper. */
    headerClassName?: string;
    /**
     * A definition shown in an `InfoHint` beside the header label — for a
     * column whose NAME is a term of art a reader may not know. The header owns
     * the icon, its spacing and its accessible name (`About <label>`), so every
     * table explains a column the same way instead of each hand-rolling a node
     * header to fit one in.
     */
    hint?: ReactNode;
    /**
     * The header's text is still being read (it names whose data the table shows): the header draws an `h5` bar in
     * its label's own box, so the header row and the column keep their size. A flag, not an empty header: `''` is a
     * column with no label.
     */
    headerLoading?: boolean;
    /**
     * The cell's form in the GRID layout (`<DataTable layout="grid">`): one 48px line, normally a `DataTable.Cell`.
     * `cell` stays the card-row form, for the same table in the cards layout. A column without it draws `cell` in
     * both layouts (clipped to one line in the grid).
     */
    gridCell?: (context: CellContext<TData, TValue>) => ReactNode;
    /**
     * What a non-data column is in the grid layout: the selection column (always first, pinned left) or a row-action
     * column (always last, pinned right). Set by `selectionColumn()` / `actionColumn()`, not by hand.
     */
    gridKind?: 'select' | 'action';
    /**
     * The column's name where columns are listed by name (the grid table's settings menu), in sentence case:
     * "Device", "Last login". Without it the list shows the header text, or the column id when the header is a node.
     */
    label?: string;
  }
}

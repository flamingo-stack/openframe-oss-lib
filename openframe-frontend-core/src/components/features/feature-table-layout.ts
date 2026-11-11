import type { ReactNode } from 'react';
import type { DataTableLayout, DataTableProps, DataTableSettings } from '../ui/data-table';

/**
 * What a feature table takes to draw its `DataTable` in the grid layout. The table passes them on and changes nothing
 * else: whether its columns are ready for the grid (a `size`, a one-line `meta.gridCell`, action columns) is a matter
 * of its column definitions. See `docs/DATA_TABLE_GRID.md` before a host asks for the grid.
 */
export interface FeatureTableLayoutProps {
  /**
   * The table's layout. `grid`: one bordered block of 48px one-line rows from `md` up; below `md` the table draws its
   * card rows in either layout. Default `cards`.
   */
  layout?: DataTableLayout;
  /**
   * Grid layout: the table's height. `'fill'` takes the height the page leaves under the table's top, so the table
   * scrolls and the page does not. See `DataTable`'s `maxHeight`.
   */
  tableMaxHeight?: number | string;
  /** Grid layout: the table's settings (the gear's menu of columns, the saved column layout). See `DataTable`. */
  tableSettings?: DataTableSettings;
}

/**
 * The `DataTable` props of a feature table's layout. The height and the settings belong to the grid: a table left on
 * `cards` passes neither.
 */
export function dataTableLayoutProps({
  layout = 'cards',
  tableMaxHeight,
  tableSettings,
}: FeatureTableLayoutProps): Pick<DataTableProps<unknown>, 'layout' | 'maxHeight' | 'settings'> {
  return layout === 'grid' ? { layout, maxHeight: tableMaxHeight, settings: tableSettings } : { layout };
}

/**
 * Whether a slot the host may leave out holds something to draw. The grid shows a card header's right slot in
 * `<DataTable.Meta>` above the table, and an empty `Meta` would still take its row.
 */
export function hasSlotContent(slot: ReactNode): boolean {
  return slot !== null && slot !== undefined && slot !== false && slot !== '';
}

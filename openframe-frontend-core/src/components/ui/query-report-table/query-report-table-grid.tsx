'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';
import { DataTable } from '../data-table';
import { GRID_MIN_WIDTH } from '../data-table/data-table-grid-columns';
import { useDataTable } from '../data-table/use-data-table';
import type { QueryResultRow } from './types';

/** A result value as a cell prints it: the value as returned, a dash for none (as the card rows print it). */
const reportText = (value: QueryResultRow[string] | undefined) =>
  value === null || value === undefined ? '-' : String(value);

export interface QueryReportTableGridProps {
  data: QueryResultRow[];
  /** The result's columns, in the order the report draws them (`deriveColumns`). */
  columns: string[];
  /** Each column's starting width, in px: the card rows' fixed column width. */
  columnWidth: number;
  loading: boolean;
  /** The loading state announces itself. `false` inside another loading region. */
  loadingRegion: boolean;
  skeletonRows: number;
  skeletonColumns: number;
  className?: string;
}

/**
 * The report as the grid table (`layout="grid"` of `QueryReportTable`): one bordered table of one-line rows, a column
 * per field of the result, scrolling sideways inside itself. It has no settings gear: the columns are the query's own,
 * so there is no layout of them to keep. While the report is read it draws the grid's own loading form, on
 * `skeletonColumns` unnamed columns (a result's columns arrive with its rows).
 */
export function QueryReportTableGrid({
  data,
  columns,
  columnWidth,
  loading,
  loadingRegion,
  skeletonRows,
  skeletonColumns,
  className,
}: QueryReportTableGridProps) {
  const columnDefs = useMemo<ColumnDef<QueryResultRow>[]>(() => {
    if (loading) {
      return Array.from({ length: skeletonColumns }, (_, index) => ({
        id: `loading-${index}`,
        header: '',
        enableSorting: false,
        size: columnWidth,
      }));
    }
    return columns.map(key => ({
      id: key,
      accessorFn: (row: QueryResultRow) => row[key],
      header: key,
      enableSorting: false,
      size: columnWidth,
      minSize: Math.min(columnWidth, GRID_MIN_WIDTH.text),
      // A string is the grid's plain one-line text cell.
      meta: { label: key, gridCell: ({ row }) => reportText(row.original[key]) },
    }));
  }, [columns, columnWidth, loading, skeletonColumns]);

  const table = useDataTable<QueryResultRow>({
    data: loading ? [] : data,
    columns: columnDefs,
    getRowId: (_row: QueryResultRow, index: number) => String(index),
    enableSorting: false,
  });

  return (
    <DataTable table={table} layout="grid" className={className}>
      <DataTable.Header loading={loading} />
      <DataTable.Body loading={loading} loadingRegion={loadingRegion} skeletonRows={skeletonRows} />
    </DataTable>
  );
}

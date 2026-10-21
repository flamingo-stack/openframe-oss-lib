'use client';

import { type ReactNode, useCallback, useMemo } from 'react';
import { type ColumnDef, DataTable, type Row, useDataTable } from '../../ui/data-table';
import { useLoadingScope } from '../../ui/loading-scope';
import { TruncateText } from '../../ui/truncate-text';
import { OSTypeBadgeGroup } from '../os-type-badge-group';
import { ScheduleDateTimeCell, ScriptNameCell } from './script-cells';
import { SCHEDULE_COLUMNS, type ScriptsTableColumnLayout } from './scripts-table-columns';
import { OpenInNewTabCell, RowActionsCell, scriptsColumnMeta } from './scripts-table-shared';

/** One schedule, as the table shows it. The host formats the start and the repeat. */
export interface ScriptScheduleTableRow {
  id: string;
  name: string;
  description?: string | null;
  supportedPlatforms: string[];
  /** When it starts. Null: it has no date (`trigger` then says what starts it). */
  startsAt?: { date: string; time: string } | null;
  /** What starts a schedule with no date ("Device Online"). */
  trigger?: string | null;
  /** How often it runs ("Every day"). Null: it does not repeat on a clock. */
  repeat?: string | null;
  deviceCount: number;
  href?: string;
}

export interface ScriptSchedulesTableProps {
  rows: ScriptScheduleTableRow[];
  isLoading?: boolean;
  /** Column ids to leave out (`'deviceCount'`, `'supportedPlatforms'`, `'open'`). */
  hideColumns?: readonly string[];
  /** The row menu. Without it the table has no actions column. */
  renderActions?: (row: ScriptScheduleTableRow) => ReactNode;
  emptyMessage?: string;
  stickyHeader?: boolean;
  stickyHeaderOffset?: string;
  rightSlot?: ReactNode;
  skeletonRows?: number;
}

const VALUE_CLASS = 'text-ods-text-primary text-h4';

/**
 * The script schedules as a table: what runs, on which operating systems,
 * when, how often and on how many devices.
 */
export function ScriptSchedulesTable({
  rows,
  isLoading = false,
  hideColumns,
  renderActions,
  emptyMessage = 'No schedules found.',
  stickyHeader = false,
  stickyHeaderOffset,
  rightSlot,
  skeletonRows,
}: ScriptSchedulesTableProps) {
  // ONE switch: the host's read (`isLoading`) or a page's loading scope draws the header and the body's skeleton
  // rows alike.
  const loading = useLoadingScope() || isLoading;
  const columns = useMemo<ColumnDef<ScriptScheduleTableRow>[]>(() => {
    const cell = (layout: ScriptsTableColumnLayout, render: (row: ScriptScheduleTableRow) => ReactNode) => ({
      id: layout.id,
      header: layout.header ?? '',
      cell: ({ row }: { row: Row<ScriptScheduleTableRow> }) => render(row.original),
      enableSorting: false,
      // A picture of the table sorts nothing: the layout's sort icon is the live page's.
      meta: { ...scriptsColumnMeta(layout), sortable: false },
    });
    const all: ColumnDef<ScriptScheduleTableRow>[] = [
      cell(SCHEDULE_COLUMNS.name, row => <ScriptNameCell name={row.name} description={row.description} />),
      cell(SCHEDULE_COLUMNS.supportedPlatforms, row => (
        <OSTypeBadgeGroup osTypes={row.supportedPlatforms} iconSize="w-4 h-4 content-md:w-6 content-md:h-6" />
      )),
      cell(SCHEDULE_COLUMNS.dateTime, row =>
        row.startsAt ? (
          <ScheduleDateTimeCell date={row.startsAt.date} time={row.startsAt.time} />
        ) : row.trigger ? (
          <TruncateText tone="secondary">{row.trigger}</TruncateText>
        ) : null,
      ),
      cell(SCHEDULE_COLUMNS.repeat, row => (row.repeat ? <span className={VALUE_CLASS}>{row.repeat}</span> : null)),
      cell(SCHEDULE_COLUMNS.deviceCount, row => <span className={VALUE_CLASS}>{row.deviceCount}</span>),
    ];
    if (renderActions) {
      all.push(cell(SCHEDULE_COLUMNS.actions, row => <RowActionsCell>{renderActions(row)}</RowActionsCell>));
    }
    all.push(cell(SCHEDULE_COLUMNS.open, row => (row.href ? <OpenInNewTabCell href={row.href} /> : null)));
    return hideColumns ? all.filter(column => !hideColumns.includes(column.id ?? '')) : all;
  }, [hideColumns, renderActions]);

  const table = useDataTable<ScriptScheduleTableRow>({
    data: rows,
    columns,
    getRowId: (row: ScriptScheduleTableRow) => row.id,
    enableSorting: false,
  });

  const rowHref = useCallback((row: ScriptScheduleTableRow) => row.href, []);
  const showHeader = loading || rows.length > 0;

  return (
    <DataTable table={table}>
      {showHeader && (
        <DataTable.Header stickyHeader={stickyHeader} stickyHeaderOffset={stickyHeaderOffset} rightSlot={rightSlot} />
      )}
      <DataTable.Body
        loading={loading}
        skeletonRows={skeletonRows}
        emptyMessage={emptyMessage}
        rowClassName="mb-1"
        rowHref={rowHref}
      />
    </DataTable>
  );
}

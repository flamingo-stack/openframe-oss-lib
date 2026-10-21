'use client';

import { type ReactNode, useCallback, useMemo } from 'react';
import { type ColumnDef, DataTable, type Row, useDataTable } from '../../ui/data-table';
import { useLoadingScope } from '../../ui/loading-scope';
import { SquareAvatar } from '../../ui/square-avatar';
import {
  ExecutionDeviceCell,
  ExecutionInitiatorCell,
  ExecutionResultCell,
  ExecutionStatusCell,
  ExecutionTimestampCell,
} from './execution-cells';
import { EXECUTION_COLUMNS, EXECUTIONS_TABLE_COLUMNS, type ScriptsTableColumnLayout } from './scripts-table-columns';
import { OpenInNewTabCell, scriptsColumnMeta } from './scripts-table-shared';

/** One execution, as the Execution History shows it. */
export interface ScriptExecutionTableRow {
  id: string;
  executionId: string;
  /** When it was dispatched, already formatted. */
  timestamp: string;
  /** `'QUEUED'`, `'RUNNING'`, `'SUCCESS'` or `'FAILED'`. */
  status: string;
  machineName: string;
  /** The device's customer. */
  organization?: string | null;
  /** Who it ran for. */
  initiator: { name: string; initials: string; image?: string };
  /** `'MANUAL'`, `'SCHEDULED'` or `'AI_ASSISTANT'`. */
  source?: string | null;
  /** Which script ran: only where a list runs several (a schedule's). */
  scriptName?: string | null;
  /** Everything the run printed. */
  result?: string | null;
  /** The execution's page: the row's link and the open-in-new-tab button. */
  href?: string;
}

export interface ScriptExecutionsTableProps {
  rows: ScriptExecutionTableRow[];
  /**
   * The columns and their widths. Defaults to the product's
   * (`EXECUTIONS_TABLE_COLUMNS`); a host narrower than the product's page
   * passes its own arrangement of `EXECUTION_COLUMNS`.
   */
  columns?: readonly ScriptsTableColumnLayout[];
  /** Column ids to leave out (`'result'`, `'open'`). */
  hideColumns?: readonly string[];
  /** Content under a row, inside its card: an execution's output, for one. */
  renderSubRow?: (row: ScriptExecutionTableRow) => ReactNode;
  /** The table's dense rows, as tall as their two lines (the product's page uses the full row). */
  compact?: boolean;
  isLoading?: boolean;
  emptyMessage?: string;
  /** Draw the column header row; a picture short of height leaves it out. */
  showHeader?: boolean;
  /** Rendered at the right edge of the header (a row count). */
  rightSlot?: ReactNode;
  skeletonRows?: number;
}

/**
 * The Execution History of a script or a schedule, presentational: every
 * run with its time, status, device and who it ran for. Rows are a view-model
 * the host maps its executions into. The product's own page keeps its live
 * table (filters, paging, the date header) over the same cells and layout.
 */
export function ScriptExecutionsTable({
  rows,
  columns: layout = EXECUTIONS_TABLE_COLUMNS,
  hideColumns,
  renderSubRow,
  compact = false,
  isLoading = false,
  emptyMessage = 'No executions found.',
  showHeader: withHeader = true,
  rightSlot,
  skeletonRows,
}: ScriptExecutionsTableProps) {
  // ONE switch: the host's read (`isLoading`) or a page's loading scope draws the header and the body's skeleton
  // rows alike.
  const loading = useLoadingScope() || isLoading;
  const columns = useMemo<ColumnDef<ScriptExecutionTableRow>[]>(() => {
    const renderers: Record<string, (row: ScriptExecutionTableRow) => ReactNode> = {
      [EXECUTION_COLUMNS.executionId.id]: row => (
        <ExecutionTimestampCell timestamp={row.timestamp} executionId={row.executionId} />
      ),
      [EXECUTION_COLUMNS.status.id]: row => <ExecutionStatusCell status={row.status} />,
      [EXECUTION_COLUMNS.machineId.id]: row => (
        <ExecutionDeviceCell name={row.machineName} organization={row.organization} />
      ),
      [EXECUTION_COLUMNS.initiatorId.id]: row => (
        <ExecutionInitiatorCell
          avatar={
            <SquareAvatar
              variant="round"
              size="md"
              src={row.initiator.image}
              fallback={row.initiator.initials}
              alt={row.initiator.name}
              initialsClassName="text-ods-text-secondary"
            />
          }
          name={row.initiator.name}
          source={row.source}
          scriptName={row.scriptName}
        />
      ),
      [EXECUTION_COLUMNS.result.id]: row => <ExecutionResultCell result={row.result} />,
      [EXECUTION_COLUMNS.open.id]: row => (row.href ? <OpenInNewTabCell href={row.href} /> : null),
    };
    // No row menu here: its one action (copy the id) is the product's, so the actions column is left out.
    return layout
      .filter(column => renderers[column.id] && !hideColumns?.includes(column.id))
      .map(column => ({
        id: column.id,
        header: column.header ?? '',
        cell: ({ row }: { row: Row<ScriptExecutionTableRow> }) => renderers[column.id](row.original),
        enableSorting: false,
        meta: scriptsColumnMeta(column),
      }));
  }, [layout, hideColumns]);

  const table = useDataTable<ScriptExecutionTableRow>({
    data: rows,
    columns,
    getRowId: (row: ScriptExecutionTableRow) => row.id,
    enableSorting: false,
  });

  const rowHref = useCallback((row: ScriptExecutionTableRow) => row.href, []);
  const showHeader = withHeader && (loading || rows.length > 0);

  return (
    <DataTable table={table}>
      {showHeader && <DataTable.Header rightSlot={rightSlot} />}
      <DataTable.Body
        loading={loading}
        skeletonRows={skeletonRows}
        emptyMessage={emptyMessage}
        rowClassName="mb-1"
        compact={compact}
        rowHref={rowHref}
        renderSubRow={renderSubRow}
      />
    </DataTable>
  );
}

'use client';

import { type ReactNode, useCallback, useMemo } from 'react';
import { type ColumnDef, DataTable, dataTableLoadingRows, type Row, useDataTable } from '../../ui/data-table';
import { DATA_TABLE_SKELETON_ROWS } from '../../ui/data-table/utils';
import { useLoadingScope } from '../../ui/loading-scope';
import { SquareAvatar } from '../../ui/square-avatar';
import { TruncateText } from '../../ui/truncate-text';
import { OSTypeBadgeGroup } from '../os-type-badge-group';
import { ScriptNameCell } from './script-cells';
import { ScriptShellBadge } from './script-shell-badge';
import { SCRIPT_COLUMNS, type ScriptsTableColumnLayout } from './scripts-table-columns';
import { OpenInNewTabCell, RowActionsCell, scriptsColumnMeta } from './scripts-table-shared';

/** One script of the library, as the table shows it. */
export interface ScriptTableRow {
  id: string;
  name: string;
  description?: string | null;
  /** Lowercase shell id (`'powershell'`). */
  shellType: string;
  /** OS ids the script runs on (`'windows'`, `'darwin'`, `'linux'`). */
  supportedPlatforms: string[];
  /** Who added it. Null: nobody is recorded. */
  author?: { name: string; initials: string; image?: string } | null;
  /** The script's page: the row's link and the open-in-new-tab button. */
  href?: string;
}

export interface ScriptsTableProps {
  rows: ScriptTableRow[];
  isLoading?: boolean;
  /** Column ids to leave out (`'authorId'`, `'supportedPlatforms'`, `'open'`). */
  hideColumns?: readonly string[];
  /** The row menu. Without it the table has no actions column. */
  renderActions?: (row: ScriptTableRow) => ReactNode;
  emptyMessage?: string;
  stickyHeader?: boolean;
  stickyHeaderOffset?: string;
  /** Rendered at the right edge of the header (a row count). */
  rightSlot?: ReactNode;
  skeletonRows?: number;
}

const BADGE_ICON = 'h-4 w-4 content-md:h-6 content-md:w-6';

/** A script still being read: a row the table keys, every field a cell shows empty (each cell draws its loading form). */
const loadingScript = (id: string): ScriptTableRow => ({
  id,
  name: '',
  shellType: '',
  supportedPlatforms: [],
  author: { name: '', initials: '' },
  href: '',
});

/**
 * The script library as a table: name and description, shell, the operating
 * systems it runs on and who added it. Rows are a view-model the host maps its
 * own scripts into.
 */
export function ScriptsTable({
  rows,
  isLoading = false,
  hideColumns,
  renderActions,
  emptyMessage = 'No scripts found.',
  stickyHeader = false,
  stickyHeaderOffset,
  rightSlot,
  skeletonRows,
}: ScriptsTableProps) {
  // ONE switch: the host's read (`isLoading`) or a page's loading scope draws the header and the body's skeleton
  // rows alike.
  const loading = useLoadingScope() || isLoading;
  const columns = useMemo<ColumnDef<ScriptTableRow>[]>(() => {
    const cell = (layout: ScriptsTableColumnLayout, render: (row: ScriptTableRow) => ReactNode) => ({
      id: layout.id,
      header: layout.header ?? '',
      cell: ({ row }: { row: Row<ScriptTableRow> }) => render(row.original),
      enableSorting: false,
      meta: scriptsColumnMeta(layout),
    });
    const all: ColumnDef<ScriptTableRow>[] = [
      cell(SCRIPT_COLUMNS.name, row => <ScriptNameCell name={row.name} description={row.description} />),
      cell(SCRIPT_COLUMNS.shellType, row => <ScriptShellBadge value={row.shellType} iconClassName={BADGE_ICON} />),
      cell(SCRIPT_COLUMNS.supportedPlatforms, row => (
        <OSTypeBadgeGroup osTypes={row.supportedPlatforms} iconSize="w-4 h-4 content-md:w-6 content-md:h-6" />
      )),
      cell(SCRIPT_COLUMNS.authorId, row =>
        row.author ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <SquareAvatar
              variant="round"
              size="sm"
              src={row.author.image}
              fallback={row.author.initials}
              alt={row.author.name}
              initialsClassName="text-ods-text-secondary"
            />
            <div className="min-w-0 flex-1">
              <TruncateText>{row.author.name}</TruncateText>
            </div>
          </div>
        ) : null,
      ),
    ];
    if (renderActions) {
      all.push(cell(SCRIPT_COLUMNS.actions, row => <RowActionsCell>{renderActions(row)}</RowActionsCell>));
    }
    all.push(cell(SCRIPT_COLUMNS.open, row => (row.href !== undefined ? <OpenInNewTabCell href={row.href} /> : null)));
    return hideColumns ? all.filter(column => !hideColumns.includes(column.id ?? '')) : all;
  }, [hideColumns, renderActions]);

  // While loading the table holds one page of placeholder rows, drawn with the real cells (`loadingCells`).
  const loadingRows = useMemo(
    () => (loading ? dataTableLoadingRows(skeletonRows ?? DATA_TABLE_SKELETON_ROWS, loadingScript) : null),
    [loading, skeletonRows],
  );
  const table = useDataTable<ScriptTableRow>({
    data: loadingRows ?? rows,
    columns,
    getRowId: (row: ScriptTableRow) => row.id,
    enableSorting: false,
  });

  const rowHref = useCallback((row: ScriptTableRow) => row.href || undefined, []);
  const showHeader = loading || rows.length > 0;

  return (
    <DataTable table={table}>
      {showHeader && (
        <DataTable.Header stickyHeader={stickyHeader} stickyHeaderOffset={stickyHeaderOffset} rightSlot={rightSlot} />
      )}
      <DataTable.Body
        loading={loading}
        loadingCells
        skeletonRows={skeletonRows}
        emptyMessage={emptyMessage}
        rowClassName="mb-1"
        rowHref={rowHref}
      />
    </DataTable>
  );
}

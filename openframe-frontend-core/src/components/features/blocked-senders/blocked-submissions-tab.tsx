'use client';

import { useMemo } from 'react';
import { useSelfFetch } from '../../../hooks/use-self-fetch';
import {
  BLOCKED_SENDERS_PAGE_SIZE,
  type BlockedSendersPageResult,
  type BlockedSubmissionRow,
  blockedSendersUrl,
} from '../../../types/blocked-senders';
import { type ColumnDef, DataTable, dataTableLoadingRows, type Row, useDataTable } from '../../ui/data-table';
import { LoadError } from '../../ui/error-state';
import { LoadingWhen, useLoadingScope } from '../../ui/loading-scope';
import { StatusBadge } from '../../ui/status-badge';
import { UnifiedPagination } from '../../unified-pagination';
import { formatBlockedDateTime, formLabel } from './blocked-senders-presentation';
import { BlockedSendersSearch } from './blocked-senders-search';
import { CellText } from './cell-text';
import { ReloadFailedNotice } from './reload-failed-notice';

/** A submission still being read: every cell draws its loading form. */
const loadingSubmission = (id: string): BlockedSubmissionRow => ({
  id: -Number(id.replace(/\D/g, '') || 0) - 1,
  at: '',
  form: '',
  sender: '',
  reason: '',
  hubspot: 'not_sent',
});

export interface BlockedSubmissionsTabProps {
  endpoint: string;
  search: string;
  page: number;
  onSearch: (search: string) => void;
  onPageChange: (page: number) => void;
}

/** The Blocked submissions tab: the form submissions the gate stopped, none of them sent to HubSpot. */
export function BlockedSubmissionsTab({ endpoint, search, page, onSearch, onPageChange }: BlockedSubmissionsTabProps) {
  const url = blockedSendersUrl(endpoint, 'submissions', {
    q: search,
    page: page > 1 ? page : null,
    pageSize: BLOCKED_SENDERS_PAGE_SIZE,
  });
  const { data, dataUrl, error, reload } = useSelfFetch<BlockedSendersPageResult<BlockedSubmissionRow>>(url);
  const inScope = useLoadingScope();

  if (error && dataUrl !== url && !inScope) {
    return <LoadError message="Could not read the blocked submissions." onRetry={reload} />;
  }

  const loading = inScope || dataUrl !== url || !data;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-m)]">
      {error && !inScope && dataUrl === url && (
        <ReloadFailedNotice message="Could not read the blocked submissions." onRetry={reload} />
      )}
      <BlockedSendersSearch
        value={search}
        onSearch={onSearch}
        placeholder="Sender or form"
        hintLabel="About blocked submissions"
        hint="Form submissions the gate stopped. Every submission is checked live against the OpenFrame blocklist, with no cache, so a block applies to the very next one. Stopped submissions are kept here, never posted to Slack or sent to HubSpot; the visitor saw the normal thank-you."
      />
      <LoadingWhen loading={loading} label="Loading the blocked submissions">
        <BlockedSubmissionsTable rows={data?.items ?? []} totalCount={data?.totalCount ?? 0} search={search} />
        <UnifiedPagination
          currentPage={data?.page ?? page}
          totalPages={data?.totalPages ?? 0}
          onPageChange={onPageChange}
          syncUrl={false}
          reserveSpace
        />
      </LoadingWhen>
    </div>
  );
}

function HubspotCell() {
  const loading = useLoadingScope();
  return <StatusBadge text="Not sent" colorScheme="error" loading={loading} />;
}

function BlockedSubmissionsTable({
  rows,
  totalCount,
  search,
}: {
  rows: BlockedSubmissionRow[];
  totalCount: number;
  search: string;
}) {
  const loading = useLoadingScope();
  const columns = useMemo<ColumnDef<BlockedSubmissionRow>[]>(
    () => [
      {
        id: 'at',
        header: 'When',
        cell: ({ row }: { row: Row<BlockedSubmissionRow> }) => (
          <CellText tone="secondary">{row.original.at ? formatBlockedDateTime(row.original.at) : ''}</CellText>
        ),
        enableSorting: false,
        meta: { width: 'w-44' },
      },
      {
        id: 'form',
        header: 'Form',
        cell: ({ row }: { row: Row<BlockedSubmissionRow> }) => <CellText>{formLabel(row.original.form)}</CellText>,
        enableSorting: false,
        meta: { width: 'w-36', hideAt: 'md' },
      },
      {
        id: 'sender',
        header: 'Sender',
        cell: ({ row }: { row: Row<BlockedSubmissionRow> }) => <CellText mono>{row.original.sender}</CellText>,
        enableSorting: false,
        meta: { width: 'flex-[2] min-w-0' },
      },
      {
        id: 'reason',
        header: 'Why',
        cell: ({ row }: { row: Row<BlockedSubmissionRow> }) => (
          <CellText tone="secondary" lines={2}>
            {row.original.reason ?? ''}
          </CellText>
        ),
        enableSorting: false,
        meta: { width: 'flex-[3] min-w-0', hideAt: 'md' },
      },
      {
        id: 'hubspot',
        header: 'HubSpot',
        cell: () => <HubspotCell />,
        enableSorting: false,
        meta: { width: 'w-28', hideAt: 'lg' },
      },
    ],
    [],
  );
  const loadingRows = useMemo(
    () => (loading ? dataTableLoadingRows(BLOCKED_SENDERS_PAGE_SIZE, loadingSubmission) : null),
    [loading],
  );
  const table = useDataTable<BlockedSubmissionRow>({
    data: loadingRows ?? rows,
    columns,
    getRowId: row => String(row.id),
    enableSorting: false,
  });

  return (
    <DataTable table={table}>
      <DataTable.Header
        rightSlot={<DataTable.RowCount itemName="submission" totalCount={totalCount} loading={loading} />}
      />
      <DataTable.Body
        loadingCells
        skeletonRows={BLOCKED_SENDERS_PAGE_SIZE}
        minRows={BLOCKED_SENDERS_PAGE_SIZE}
        emptyState={
          search
            ? { title: 'Nothing matches', description: `No blocked submission matches "${search}".` }
            : { title: 'No blocked submissions', description: 'Nothing from a blocked sender reached a form.' }
        }
      />
    </DataTable>
  );
}

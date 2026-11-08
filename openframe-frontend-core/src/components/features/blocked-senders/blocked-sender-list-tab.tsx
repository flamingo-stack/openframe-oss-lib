'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { useSelfFetch } from '../../../hooks/use-self-fetch';
import {
  BLOCKED_SENDERS_PAGE_SIZE,
  type BlockedSenderKind,
  type BlockedSenderRow,
  type BlockedSendersListResponse,
  blockedSendersUrl,
} from '../../../types/blocked-senders';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../ui/alert-dialog';
import { Button } from '../../ui/button';
import { type ColumnDef, DataTable, dataTableLoadingRows, type Row, useDataTable } from '../../ui/data-table';
import { LoadError } from '../../ui/error-state';
import { FieldWrapper } from '../../ui/field-wrapper';
import { Input } from '../../ui/input';
import { LoadingWhen, useLoadingScope } from '../../ui/loading-scope';
import { NoData } from '../../ui/no-data';
import { StatusBadge } from '../../ui/status-badge';
import { UnifiedPagination } from '../../unified-pagination';
import {
  BLOCKED_SENDER_KIND_COPY,
  BLOCKED_SENDERS_UNKNOWN,
  EMAILS_NOT_AVAILABLE_DESCRIPTION,
  EMAILS_NOT_AVAILABLE_TITLE,
  formatBlockedDate,
  REASON_LABEL,
  REASON_PLACEHOLDER,
  SOURCE_BADGE,
} from './blocked-senders-presentation';
import { BlockedSendersSearch } from './blocked-senders-search';
import { sendBlockedSendersWrite } from './blocked-senders-write';
import { CellText } from './cell-text';
import { ReloadFailedNotice } from './reload-failed-notice';

const segmentOf = (kind: BlockedSenderKind) => (kind === 'domain' ? 'domains' : 'emails');

/** A row still being read: the table keys it, and every cell draws its loading form. */
const loadingRow = (value: string): BlockedSenderRow => ({
  value,
  kind: 'domain',
  reason: '',
  addedBy: '',
  createdAt: null,
  source: 'manual',
});

export interface BlockedSenderListTabProps {
  endpoint: string;
  kind: BlockedSenderKind;
  search: string;
  page: number;
  onSearch: (search: string) => void;
  onPageChange: (page: number) => void;
  /** Something was blocked or released: the host reloads what counts it (the tab badges). */
  onChanged: () => void;
}

/** The Domains or Emails tab: block one (with a reason), search the list on the server, and release a row. */
export function BlockedSenderListTab({
  endpoint,
  kind,
  search,
  page,
  onSearch,
  onPageChange,
  onChanged,
}: BlockedSenderListTabProps) {
  const segment = segmentOf(kind);
  const url = blockedSendersUrl(endpoint, segment, {
    q: search,
    page: page > 1 ? page : null,
    pageSize: BLOCKED_SENDERS_PAGE_SIZE,
  });
  const { data, dataUrl, error, reload } = useSelfFetch<BlockedSendersListResponse>(url);
  const inScope = useLoadingScope();
  const copy = BLOCKED_SENDER_KIND_COPY[kind];
  const [releasing, setReleasing] = useState<BlockedSenderRow | null>(null);
  const [busy, setBusy] = useState(false);

  const changed = () => {
    reload();
    onChanged();
  };

  const release = async (row: BlockedSenderRow) => {
    setBusy(true);
    const ok = await sendBlockedSendersWrite({
      url: blockedSendersUrl(endpoint, segment, { value: row.value }),
      method: 'DELETE',
      success: `Released ${row.value}. Sign-ups and forms from it are accepted again.`,
      failure: `Could not release ${row.value}`,
    });
    setBusy(false);
    setReleasing(null);
    if (ok) changed();
  };

  if (error && dataUrl !== url && !inScope) {
    return <LoadError message={`Could not read the blocked ${copy.nounPlural}.`} onRetry={reload} />;
  }

  const loading = inScope || dataUrl !== url || !data;
  const available = loading ? true : data.available;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-m)]">
      {error && !inScope && dataUrl === url && (
        <ReloadFailedNotice message={`Could not read the blocked ${copy.nounPlural}.`} onRetry={reload} />
      )}
      {!available && <NoData title={EMAILS_NOT_AVAILABLE_TITLE} description={EMAILS_NOT_AVAILABLE_DESCRIPTION} />}
      <BlockSenderForm endpoint={endpoint} kind={kind} disabled={!available} onBlocked={changed} />
      {available && (
        <>
          <BlockedSendersSearch value={search} onSearch={onSearch} placeholder={copy.searchPlaceholder} />
          <LoadingWhen loading={loading} label={`Loading the blocked ${copy.nounPlural}`}>
            <BlockedSendersTable
              kind={kind}
              rows={data?.items ?? []}
              totalCount={data?.totalCount ?? 0}
              search={search}
              onRelease={setReleasing}
            />
            <UnifiedPagination
              currentPage={data?.page ?? page}
              totalPages={data?.totalPages ?? 0}
              onPageChange={onPageChange}
              syncUrl={false}
              reserveSpace
            />
          </LoadingWhen>
        </>
      )}
      <AlertDialog open={releasing !== null} onOpenChange={open => !open && !busy && setReleasing(null)}>
        <AlertDialogContent className="border-ods-border bg-ods-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-ods-text-primary">Release {releasing?.value}?</AlertDialogTitle>
            <AlertDialogDescription className="text-ods-text-secondary">
              Sign-ups and forms from it are accepted again from the next request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-[var(--spacing-system-xs)]">
            <AlertDialogCancel disabled={busy} className="border-ods-border bg-transparent text-ods-text-primary">
              Cancel
            </AlertDialogCancel>
            <Button
              variant="accent"
              loading={busy}
              disabled={busy}
              onClick={() => {
                if (releasing) void release(releasing);
              }}
            >
              Release
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface BlockSenderFormProps {
  endpoint: string;
  kind: BlockedSenderKind;
  disabled: boolean;
  onBlocked: () => void;
}

/** Block one domain or address. Both the value and the reason are required. */
function BlockSenderForm({ endpoint, kind, disabled, onBlocked }: BlockSenderFormProps) {
  const copy = BLOCKED_SENDER_KIND_COPY[kind];
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const canSave = !disabled && !saving && value.trim() !== '' && reason.trim() !== '';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    const target = value.trim();
    setSaving(true);
    const ok = await sendBlockedSendersWrite({
      url: blockedSendersUrl(endpoint, segmentOf(kind)),
      method: 'POST',
      body: { value: target, reason: reason.trim() },
      success: `Blocked ${target}.`,
      failure: `Could not block ${target}`,
    });
    setSaving(false);
    if (!ok) return;
    setValue('');
    setReason('');
    onBlocked();
  };

  return (
    <form
      onSubmit={event => void submit(event)}
      className="flex flex-col gap-[var(--spacing-system-sf)] rounded-2xl border border-ods-border bg-ods-card p-[var(--spacing-system-m)]"
    >
      <div className="flex flex-col gap-[var(--spacing-system-sf)] content-md:flex-row content-md:items-end">
        <div className="min-w-0 content-md:flex-1">
          <FieldWrapper label={copy.fieldLabel} htmlFor={`blocked-senders-${kind}-value`}>
            <Input
              id={`blocked-senders-${kind}-value`}
              placeholder={copy.placeholder}
              value={value}
              onChange={event => setValue(event.target.value)}
              disabled={disabled || saving}
              required
              userValue
            />
          </FieldWrapper>
        </div>
        <div className="min-w-0 content-md:flex-[3]">
          <FieldWrapper label={REASON_LABEL} htmlFor={`blocked-senders-${kind}-reason`}>
            <Input
              id={`blocked-senders-${kind}-reason`}
              placeholder={REASON_PLACEHOLDER}
              value={reason}
              onChange={event => setReason(event.target.value)}
              disabled={disabled || saving}
              maxLength={500}
              required
              userValue
            />
          </FieldWrapper>
        </div>
        <Button type="submit" variant="accent" disabled={!canSave} loading={saving}>
          {copy.blockLabel}
        </Button>
      </div>
      <p className="text-ods-text-secondary text-h6">{copy.hint}</p>
    </form>
  );
}

interface BlockedSendersTableProps {
  kind: BlockedSenderKind;
  rows: BlockedSenderRow[];
  totalCount: number;
  search: string;
  onRelease: (row: BlockedSenderRow) => void;
}

/** The list: value, source, reason, who added it, when, and Release. Draws one page of loading rows in a scope. */
function BlockedSendersTable({ kind, rows, totalCount, search, onRelease }: BlockedSendersTableProps) {
  const copy = BLOCKED_SENDER_KIND_COPY[kind];
  const loading = useLoadingScope();
  const columns = useMemo<ColumnDef<BlockedSenderRow>[]>(
    () => [
      {
        id: 'value',
        header: copy.column,
        cell: ({ row }: { row: Row<BlockedSenderRow> }) => <CellText mono>{row.original.value}</CellText>,
        enableSorting: false,
        meta: { width: 'flex-[2] min-w-0' },
      },
      {
        id: 'source',
        header: 'Source',
        cell: ({ row }: { row: Row<BlockedSenderRow> }) => {
          const badge = SOURCE_BADGE[row.original.source];
          return <StatusBadge text={badge.label} colorScheme={badge.color} />;
        },
        enableSorting: false,
        meta: { width: 'w-28' },
      },
      {
        id: 'reason',
        header: 'Reason',
        cell: ({ row }: { row: Row<BlockedSenderRow> }) => (
          <CellText tone="secondary" lines={2}>
            {row.original.reason ?? ''}
          </CellText>
        ),
        enableSorting: false,
        meta: { width: 'flex-[3] min-w-0' },
      },
      {
        id: 'addedBy',
        header: 'Added by',
        cell: ({ row }: { row: Row<BlockedSenderRow> }) => (
          <CellText>{row.original.addedBy ?? BLOCKED_SENDERS_UNKNOWN}</CellText>
        ),
        enableSorting: false,
        meta: { width: 'flex-[2] min-w-0', hideAt: 'md' },
      },
      {
        id: 'createdAt',
        header: 'Added',
        cell: ({ row }: { row: Row<BlockedSenderRow> }) => (
          <CellText tone="secondary">{formatBlockedDate(row.original.createdAt)}</CellText>
        ),
        enableSorting: false,
        meta: { width: 'w-32', hideAt: 'md' },
      },
      {
        id: 'release',
        cell: ({ row }: { row: Row<BlockedSenderRow> }) => <ReleaseButton row={row.original} onRelease={onRelease} />,
        enableSorting: false,
        meta: { width: 'w-28', align: 'right' },
      },
    ],
    [copy.column, onRelease],
  );
  const loadingRows = useMemo(
    () => (loading ? dataTableLoadingRows(BLOCKED_SENDERS_PAGE_SIZE, loadingRow) : null),
    [loading],
  );
  const table = useDataTable<BlockedSenderRow>({
    data: loadingRows ?? rows,
    columns,
    getRowId: row => row.value,
    enableSorting: false,
  });

  return (
    <DataTable table={table}>
      <DataTable.Header
        rightSlot={
          <DataTable.RowCount
            itemName={copy.noun}
            pluralize={(count, noun) => (count === 1 ? noun : copy.nounPlural)}
            totalCount={totalCount}
            loading={loading}
          />
        }
      />
      <DataTable.Body
        loadingCells
        skeletonRows={BLOCKED_SENDERS_PAGE_SIZE}
        emptyState={
          search
            ? { title: 'Nothing matches', description: `No blocked ${copy.noun} matches "${search}".` }
            : {
                title: `No blocked ${copy.nounPlural}`,
                description: copy.emptyHint,
              }
        }
        rowClassName="mb-[var(--spacing-system-xxs)]"
      />
    </DataTable>
  );
}

/** Release, drawn real and inert while the row is read. */
function ReleaseButton({ row, onRelease }: { row: BlockedSenderRow; onRelease: (row: BlockedSenderRow) => void }) {
  const loading = useLoadingScope();
  return (
    <div className="flex justify-end">
      <Button
        variant="outline"
        size="small"
        disabled={loading}
        onClick={loading ? undefined : () => onRelease(row)}
        aria-label={loading ? undefined : `Release ${row.value}`}
      >
        Release
      </Button>
    </div>
  );
}

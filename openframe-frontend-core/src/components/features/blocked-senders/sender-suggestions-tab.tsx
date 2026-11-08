'use client';

import { useState } from 'react';
import { useSelfFetch } from '../../../hooks/use-self-fetch';
import {
  BLOCKED_SENDERS_PAGE_SIZE,
  type BlockedSendersPageResult,
  type SenderSuggestionRow,
  blockedSenderSuggestionUrl,
  blockedSendersUrl,
} from '../../../types/blocked-senders';
import { TextLineSkeleton } from '../../loading/unified-skeleton';
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
import { LoadError } from '../../ui/error-state';
import { FieldWrapper } from '../../ui/field-wrapper';
import { LoadingItems, LoadingWhen, loadingItemProps, useLoadingScope } from '../../ui/loading-scope';
import { NoData } from '../../ui/no-data';
import { StatusBadge } from '../../ui/status-badge';
import { Textarea } from '../../ui/textarea';
import { UnifiedPagination } from '../../unified-pagination';
import {
  isOpenSuggestion,
  KIND_LABEL,
  REASON_LABEL,
  SIGNAL_STRENGTH_BADGE,
  signalPoints,
  submissionCountLabel,
  strongSignalsClause,
  SUGGESTION_STATE_BADGE,
} from './blocked-senders-presentation';
import { BlockedSendersSearch } from './blocked-senders-search';
import { sendBlockedSendersWrite } from './blocked-senders-write';
import { CellText } from './cell-text';
import { ReloadFailedNotice } from './reload-failed-notice';

/** The signal lines a loading card draws: a typical sender's count. */
const LOADING_SIGNAL_LINES = 3;

export interface SenderSuggestionsTabProps {
  endpoint: string;
  search: string;
  page: number;
  /** The overview's bars, for the intro sentence; null while the overview is read. */
  bars: { suggest: number; block: number; minStrong: number } | null;
  onSearch: (search: string) => void;
  onPageChange: (page: number) => void;
  onChanged: () => void;
}

/** The Suggestions tab: scored senders with every signal and its evidence; Block one, or mark it not spam. */
export function SenderSuggestionsTab({
  endpoint,
  search,
  page,
  bars,
  onSearch,
  onPageChange,
  onChanged,
}: SenderSuggestionsTabProps) {
  const url = blockedSendersUrl(endpoint, 'suggestions', {
    q: search,
    page: page > 1 ? page : null,
    pageSize: BLOCKED_SENDERS_PAGE_SIZE,
  });
  const { data, dataUrl, error, reload } = useSelfFetch<BlockedSendersPageResult<SenderSuggestionRow>>(url);
  const inScope = useLoadingScope();
  const [blocking, setBlocking] = useState<SenderSuggestionRow | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<number | null>(null);

  const changed = () => {
    reload();
    onChanged();
  };

  const openBlock = (row: SenderSuggestionRow) => {
    setReason(row.suggestedReason);
    setBlocking(row);
  };

  const block = async (row: SenderSuggestionRow) => {
    if (!reason.trim()) return;
    setBusy(row.id);
    const ok = await sendBlockedSendersWrite({
      url: blockedSenderSuggestionUrl(endpoint, row.id, 'block'),
      method: 'POST',
      body: { reason: reason.trim() },
      success: `Blocked ${row.sender}.`,
      failure: `Could not block ${row.sender}`,
    });
    setBusy(null);
    setBlocking(null);
    if (ok) changed();
  };

  const notSpam = async (row: SenderSuggestionRow) => {
    setBusy(row.id);
    const ok = await sendBlockedSendersWrite({
      url: blockedSenderSuggestionUrl(endpoint, row.id, 'not-spam'),
      method: 'POST',
      success: `${row.sender} will not be suggested again.`,
      failure: `Could not mark ${row.sender} as not spam`,
    });
    setBusy(null);
    if (ok) changed();
  };

  if (error && dataUrl !== url && !inScope) {
    return <LoadError message="Could not read the suggestions." onRetry={reload} />;
  }

  const loading = inScope || dataUrl !== url || !data;
  const rows = data?.items ?? [];

  return (
    <div className="flex flex-col gap-[var(--spacing-system-m)]">
      {error && !inScope && dataUrl === url && (
        <ReloadFailedNotice message="Could not read the suggestions." onRetry={reload} />
      )}
      <p className="text-ods-text-secondary text-h5">
        Senders that got through the gate, scored on every submission and every few minutes. Suggested at{' '}
        <BarValue value={bars?.suggest} /> points; auto-blocked at <BarValue value={bars?.block} /> points
        {bars ? (
          strongSignalsClause(bars.minStrong)
        ) : (
          <>
            {' '}
            with at least <BarValue value={undefined} /> strong signal
          </>
        )}
        . A real customer, an open deal, a paying tenant or a held meeting counts against a sender. Block one, or mark
        it not spam so it is never suggested again.
      </p>
      <BlockedSendersSearch value={search} onSearch={onSearch} placeholder="Domain or address" />
      <LoadingWhen loading={loading} label="Loading the suggestions">
        <SuggestionList
          rows={rows}
          search={search}
          busy={busy}
          onBlock={openBlock}
          onNotSpam={row => void notSpam(row)}
        />
        <UnifiedPagination
          currentPage={data?.page ?? page}
          totalPages={data?.totalPages ?? 0}
          onPageChange={onPageChange}
          syncUrl={false}
          reserveSpace
        />
      </LoadingWhen>
      <AlertDialog open={blocking !== null} onOpenChange={open => !open && busy === null && setBlocking(null)}>
        <AlertDialogContent className="border-ods-border bg-ods-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-ods-text-primary">Block {blocking?.sender}?</AlertDialogTitle>
            <AlertDialogDescription className="text-ods-text-secondary">
              Sign-up and every hub form refuse it from the next request. The reason is kept with the block.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FieldWrapper label={REASON_LABEL} htmlFor="blocked-senders-suggestion-reason">
            <Textarea
              id="blocked-senders-suggestion-reason"
              value={reason}
              onChange={event => setReason(event.target.value)}
              maxLength={500}
              rows={3}
              required
            />
          </FieldWrapper>
          <AlertDialogFooter className="gap-[var(--spacing-system-xs)]">
            <AlertDialogCancel
              disabled={busy !== null}
              className="border-ods-border bg-transparent text-ods-text-primary"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              variant="accent"
              loading={busy !== null}
              disabled={busy !== null || !reason.trim()}
              onClick={() => {
                if (blocking) void block(blocking);
              }}
            >
              {blocking?.kind === 'address' ? 'Block address' : 'Block domain'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** A number of the intro sentence; while the overview is read, an inline bar of the same line. */
function BarValue({ value }: { value: number | undefined }) {
  if (value === undefined) return <TextLineSkeleton as="span" type="h5" className="inline-flex w-6 align-bottom" />;
  return <span className="tabular-nums">{value}</span>;
}

interface SuggestionListProps {
  rows: SenderSuggestionRow[];
  search: string;
  busy: number | null;
  onBlock: (row: SenderSuggestionRow) => void;
  onNotSpam: (row: SenderSuggestionRow) => void;
}

/** One card per sender; in a loading scope, a page of loading cards. */
function SuggestionList({ rows, search, busy, onBlock, onNotSpam }: SuggestionListProps) {
  const loading = useLoadingScope();
  if (loading) {
    return (
      <div className="flex flex-col gap-[var(--spacing-system-sf)]">
        <LoadingItems count={BLOCKED_SENDERS_PAGE_SIZE}>
          {() => <SuggestionCard data-loading-item busy={false} onBlock={onBlock} onNotSpam={onNotSpam} />}
        </LoadingItems>
      </div>
    );
  }
  if (rows.length === 0) {
    return search ? (
      <NoData title="Nothing matches" description={`No suggestion matches "${search}".`} />
    ) : (
      <NoData title="No suggestions" description="Every recent sender looks fine." />
    );
  }
  return (
    <div className="flex flex-col gap-[var(--spacing-system-sf)]">
      {rows.map(row => (
        <SuggestionCard
          key={row.id}
          data-loading-item
          row={row}
          busy={busy === row.id}
          onBlock={onBlock}
          onNotSpam={onNotSpam}
        />
      ))}
    </div>
  );
}

interface SuggestionCardProps {
  /** Absent while the page is read: the card draws its loading form. */
  row?: SenderSuggestionRow;
  busy: boolean;
  onBlock: (row: SenderSuggestionRow) => void;
  onNotSpam: (row: SenderSuggestionRow) => void;
  /** The list's item marker, on the loaded card and its loading form alike. */
  'data-loading-item'?: boolean;
}

/** A sender: its value, kind, score and submissions, every signal with its points and evidence, and the actions. */
function SuggestionCard({ row, busy, onBlock, onNotSpam, ...rest }: SuggestionCardProps) {
  // In a loading scope, or with no row yet, the card draws its loading form.
  const shown = useLoadingScope() ? null : (row ?? null);
  const loading = shown === null;
  const state = shown ? SUGGESTION_STATE_BADGE[shown.state] : null;
  const open = shown ? isOpenSuggestion(shown.state) : true;
  return (
    <article
      {...loadingItemProps(rest)}
      className="flex flex-col gap-[var(--spacing-system-sf)] rounded-2xl border border-ods-border bg-ods-card p-[var(--spacing-system-m)]"
    >
      <div className="flex flex-wrap items-center gap-[var(--spacing-system-xs)] content-md:gap-[var(--spacing-system-m)]">
        <div className="min-w-0 flex-1 basis-48">
          <CellText mono variant="h4">
            {shown?.sender ?? ''}
          </CellText>
        </div>
        <StatusBadge text={shown ? KIND_LABEL[shown.kind] : ''} colorScheme="default" loading={loading} />
        {state && !open && <StatusBadge text={state.label} colorScheme={state.color} />}
        {shown ? (
          <span className="tabular-nums text-ods-text-primary text-h3">
            {shown.score} <span className="text-ods-text-secondary text-h6">score</span>
          </span>
        ) : (
          <TextLineSkeleton type="h3" className="w-24" />
        )}
        {shown ? (
          <span className="text-ods-text-secondary text-h6">{submissionCountLabel(shown.submissionCount)}</span>
        ) : (
          <TextLineSkeleton type="h6" className="w-28" />
        )}
      </div>
      {shown ? (
        <ul className="flex flex-col gap-[var(--spacing-system-xxs)]">
          {shown.signals.map(signal => {
            const badge = SIGNAL_STRENGTH_BADGE[signal.strength];
            return (
              <li key={signal.id} className="flex flex-wrap items-baseline gap-[var(--spacing-system-xs)] text-h6">
                <StatusBadge text={badge.label} colorScheme={badge.color} />
                <span className="w-8 tabular-nums text-ods-text-primary [font-family:var(--font-family-heading)]">
                  {signalPoints(signal.points)}
                </span>
                <span className="text-ods-text-primary">{signal.label}</span>
                {signal.evidence && <span className="text-ods-text-secondary">{signal.evidence}</span>}
              </li>
            );
          })}
        </ul>
      ) : (
        <TextLineSkeleton type="h6" lines={LOADING_SIGNAL_LINES} className="w-3/4" />
      )}
      {open && (
        <div className="flex flex-wrap items-center gap-[var(--spacing-system-xs)] content-md:gap-[var(--spacing-system-m)]">
          <Button
            variant="accent"
            size="small"
            disabled={loading || busy}
            onClick={shown ? () => onBlock(shown) : undefined}
          >
            {shown?.kind === 'address' ? 'Block address' : 'Block domain'}
          </Button>
          <Button
            variant="outline"
            size="small"
            disabled={loading || busy}
            loading={busy}
            onClick={shown ? () => onNotSpam(shown) : undefined}
          >
            Not spam
          </Button>
          {shown ? (
            <span className="text-ods-text-secondary text-h6">{shown.verdict}</span>
          ) : (
            <TextLineSkeleton type="h6" className="w-64" />
          )}
        </div>
      )}
    </article>
  );
}

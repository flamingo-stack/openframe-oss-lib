'use client';

/**
 * `<TicketCenter />` — the customer-facing ticket management surface.
 *
 * Single component the hub mounts at `/tickets` and that third-party
 * apps embed alongside `<EmbeddableChat />`. The lib intentionally does
 * NOT bundle a QueryClientProvider or ChatRuntimeContext.Provider — the
 * embedder mounts both at their app root (same pattern as
 * `<EmbeddableChat />`).
 *
 * Identity gate: if the chat-identity hook reports anon, render ONLY a
 * sign-in EmptyState — no form, no list, no fetch. This keeps the
 * Network tab clean for anon visitors and prevents the form from
 * accepting input that would 401 on submit.
 *
 * LOADING: while the identity or the tickets are read (or in a host's loading scope) the center renders its SAME view
 * with no tickets inside a `LoadingScope` (`TicketCenterPending`): the open-ticket form is drawn for real (inert), the
 * list's header is real with its sync line's skeleton, and the list draws its own skeleton.
 */

import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { type ReactNode, useCallback, useState } from 'react';
import { toast as defaultToast } from '../../hooks/use-toast';
import type { DataSync } from '../../types/data-sync';
import { devSectionAnchorId } from '../../utils/dev-sections/dev-section-param-keys';
import { ChatTicketItem } from '../chat/entity-cards/chat-ticket-item';
import { useChatIdentity } from '../chat/hooks/use-chat-identity';
import { EmptyState } from '../empty-state';
import { usePageDataSync } from '../layout/page-data-sync';
import { LoadingRegion } from '../loading/loading-region';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { DataSyncLine } from '../ui/data-attribution';
import { LoadingItems, LoadingScope, useLoadingScope } from '../ui/loading-scope';
import { useTicketActions } from './hooks/use-ticket-actions';
import { TICKETS_PAGE_SIZE, useTicketsList } from './hooks/use-tickets-list';
import { TicketOpenForm, type TicketOpenFormProps } from './ticket-open-form';
import { TicketRow } from './ticket-row';
import type { AnyTicket, OptimisticTicket, TicketData } from './types';
import { isOptimistic } from './types';

/** The center's layout. */
const TICKET_CENTER_CLASS = 'flex flex-col gap-6';
const TICKET_LIST_BLOCK_CLASS = 'flex flex-col gap-2';
const TICKET_ROW_FRAME_CLASS = 'border-b border-ods-border last:border-b-0';

export interface TicketCenterProps {
  /** Optional toast override (test-friendly). Defaults to the lib's
   *  shared toast singleton. */
  toast?: typeof defaultToast;
}

export function TicketCenter({ toast = defaultToast }: TicketCenterProps = {}) {
  // In a page's loading state nothing is read: no identity, no ticket list (the gate below owns those reads).
  if (useLoadingScope()) return <TicketCenterPending region={false} />;
  return <TicketCenterGate toast={toast} />;
}

function TicketCenterGate({ toast }: { toast: typeof defaultToast }) {
  const identity = useChatIdentity();
  // Loading window — wait for the capability bag to resolve before
  // deciding what to render. `identity.isLoading` is the first-mount
  // window; once resolved we know authTier definitively.
  if (identity.isLoading) {
    return <TicketCenterPending />;
  }
  if (identity.authTier === 'anon' || !identity.user?.email) {
    return (
      <EmptyState
        type="generic"
        title="Sign in to manage tickets"
        description="View, open, and follow up on support tickets after signing in."
        showCTA={false}
      />
    );
  }
  return <TicketCenterAuthed toast={toast} sessionEmail={identity.user.email} />;
}

function TicketCenterAuthed({
  toast,
  sessionEmail,
}: {
  toast: typeof defaultToast;
  /** Identity drilled from the parent — see `useTicketsList`'s
   *  `customerEmail` arg doc for the race-cause rationale. */
  sessionEmail: string;
}) {
  const queryClient = useQueryClient();
  const { tickets, isLoading, isFetching, refetch, sync } = useTicketsList({
    customerEmail: sessionEmail,
  });
  const [optimisticTickets, setOptimisticTickets] = useState<OptimisticTicket[]>([]);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [supportSystemDown, setSupportSystemDown] = useState(false);

  // Optimistic cache management. Kept LOCAL (not in the query cache) so
  // a refetch doesn't blow away pending placeholders mid-flight. The
  // merged view is `[...optimistic, ...server]` so optimistic rows sit
  // at the top until they're explicitly removed.
  const prependOptimistic = useCallback((placeholder: OptimisticTicket) => {
    setOptimisticTickets(prev => [placeholder, ...prev]);
  }, []);
  const removeOptimistic = useCallback((placeholderId: string) => {
    setOptimisticTickets(prev => prev.filter(t => t.id !== placeholderId));
    // If the parent had this temp id expanded (shouldn't happen — the
    // drawer is hidden on optimistic rows — but defensive), null it
    // so we don't dangle a stale id.
    setExpandedTicketId(prev => (prev === placeholderId ? null : prev));
  }, []);
  const removeTicketFromCache = useCallback(
    (ticketId: string) => {
      // Target every cache slot under the ['tickets'] prefix — the
      // queryKey now includes an identityKey segment (use-tickets-list)
      // so a bare ['tickets', 'self'] write would no-op silently.
      queryClient.setQueriesData<TicketData[] | undefined>({ queryKey: ['tickets'] }, prev =>
        (prev ?? []).filter(t => t.id !== ticketId),
      );
      setExpandedTicketId(prev => (prev === ticketId ? null : prev));
    },
    [queryClient],
  );

  const actions = useTicketActions({
    prependOptimistic,
    removeOptimistic,
    removeTicketFromCache,
    toast,
    onSupportSystemDown: () => setSupportSystemDown(true),
  });

  const toggleRow = useCallback((id: string) => {
    setExpandedTicketId(prev => (prev === id ? null : id));
  }, []);

  // The page states the sync under its title; the ticket list shown without that page draws it in its own header.
  const syncInPage = usePageDataSync(sync, isLoading);

  const merged: AnyTicket[] = [...optimisticTickets, ...tickets];

  return (
    <TicketCenterView
      tickets={merged}
      loading={isLoading}
      sync={syncInPage ? undefined : sync}
      onRefresh={refetch}
      refreshing={isFetching}
      onSubmit={input => actions.submitTicket(input)}
      isSubmitting={actions.isSubmittingForm}
      supportSystemDown={supportSystemDown}
      renderRow={ticket => (
        <TicketRow
          key={ticket.id}
          id={devSectionAnchorId('ticket', ticket.external_id)}
          ticket={ticket}
          expanded={expandedTicketId === ticket.id}
          onToggle={toggleRow}
          busy={isOptimistic(ticket) ? false : actions.isRowBusy(ticket.id)}
          supportSystemDown={supportSystemDown}
          onSendMessage={actions.sendMessage}
          onClose={actions.closeTicket}
          onReopen={actions.reopenTicket}
          onActionCollapsed={() => setExpandedTicketId(null)}
        />
      )}
    />
  );
}

/**
 * The center while its identity is read (or in a host's loading scope): the SAME view, with no tickets and nothing
 * usable, inside a `LoadingScope` where every part draws its own loading state. Announced once (`region`).
 */
function TicketCenterPending({
  region = true,
}: {
  /** The loading state announces itself (`LoadingRegion`). `false` inside another loading region. Default `true`. */
  region?: boolean;
} = {}) {
  // The page states the sync under its title: the list's header then draws no line, loading or loaded.
  const syncInPage = usePageDataSync(null, true);
  return (
    <LoadingRegion label="Loading tickets" announce={region}>
      <LoadingScope>
        <TicketCenterView
          tickets={[]}
          loading
          formInert
          sync={syncInPage ? undefined : null}
          onSubmit={() => Promise.resolve(false)}
          isSubmitting={false}
          supportSystemDown={false}
          renderRow={() => null}
        />
      </LoadingScope>
    </LoadingRegion>
  );
}

/** The center's ONE view, loaded and loading: the open-ticket form, then the list under its header. */
function TicketCenterView({
  tickets,
  loading,
  formInert = false,
  sync,
  onRefresh,
  refreshing,
  onSubmit,
  isSubmitting,
  supportSystemDown,
  renderRow,
}: {
  tickets: AnyTicket[];
  /** The tickets are being read: the list draws its skeleton. */
  loading: boolean;
  /** The identity is not read yet: the form is drawn for real but cannot be focused, typed into or submitted. */
  formInert?: boolean;
  /** `undefined`: the page states the sync, the header draws no line. */
  sync: DataSync | null | undefined;
  /** Absent while loading, where the button is drawn but cannot be used. */
  onRefresh?: () => void;
  refreshing?: boolean;
  onSubmit: TicketOpenFormProps['onSubmit'];
  isSubmitting: boolean;
  supportSystemDown: boolean;
  renderRow: (ticket: AnyTicket) => ReactNode;
}) {
  return (
    <div className={TICKET_CENTER_CLASS}>
      {/* `contents`: the wrapper adds no box, the form stays the view's own child. */}
      <div inert={formInert || undefined} className="contents">
        <TicketOpenForm onSubmit={onSubmit} isSubmitting={isSubmitting} supportSystemDown={supportSystemDown} />
      </div>

      <div className={TICKET_LIST_BLOCK_CLASS}>
        <TicketListHeader sync={sync} syncLoading={loading} onRefresh={onRefresh} refreshing={refreshing} />
        <TicketList tickets={tickets} loading={loading} renderRow={renderRow} />
      </div>
    </div>
  );
}

/** The ticket list: its own skeleton while the tickets are read (`useLoadingScope() || loading`), else rows or empty. */
function TicketList({
  tickets,
  loading,
  renderRow,
}: {
  tickets: AnyTicket[];
  loading: boolean;
  renderRow: (ticket: AnyTicket) => ReactNode;
}) {
  if (useLoadingScope() || loading) return <TicketListSkeleton />;
  if (tickets.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          type="generic"
          title="No tickets yet"
          description="Open one above to start the conversation."
          showCTA={false}
        />
      </Card>
    );
  }
  return <Card className="overflow-hidden">{tickets.map(renderRow)}</Card>;
}

/**
 * The list's header, loaded and loading: "Your Current Tickets" (static), the sync line (when the page does not
 * state it above) and the refresh button.
 */
function TicketListHeader({
  sync,
  syncLoading,
  onRefresh,
  refreshing = false,
}: {
  /** `undefined`: the page states the sync, the header draws no line. */
  sync: DataSync | null | undefined;
  syncLoading: boolean;
  /** Absent in the skeleton, where the button is drawn but cannot be used. */
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-ods-text-secondary text-h5">Your Current Tickets</p>
      <div className="flex items-center gap-3 text-ods-text-secondary text-h6">
        {sync !== undefined && <DataSyncLine sync={sync} loading={syncLoading} inline />}
        <span inert={!onRefresh || undefined} aria-hidden={!onRefresh || undefined}>
          <Button
            type="button"
            variant="transparent"
            size="small"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh ticket list"
            leftIcon={<RefreshCw className="h-4 w-4" />}
          />
        </span>
      </div>
    </div>
  );
}

/** The ticket list while it is read: ONE FULL PAGE of rows (the list reads `TICKETS_PAGE_SIZE` tickets), at every width. */
function TicketListSkeleton() {
  return (
    <Card className="overflow-hidden">
      <LoadingItems count={TICKETS_PAGE_SIZE}>
        {() => (
          <div className={TICKET_ROW_FRAME_CLASS}>
            <ChatTicketItem loading />
          </div>
        )}
      </LoadingItems>
    </Card>
  );
}

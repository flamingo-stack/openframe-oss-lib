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
 */

import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast as defaultToast } from '../../hooks/use-toast';
import type { DataSync } from '../../types/data-sync';
import { cn } from '../../utils/cn';
import { devSectionAnchorId } from '../../utils/dev-sections/dev-section-param-keys';
import { ChatTicketItemSkeleton } from '../chat/entity-cards/chat-ticket-item';
import { useChatIdentity } from '../chat/hooks/use-chat-identity';
import { EmptyState } from '../empty-state';
import { usePageDataSync } from '../layout/page-data-sync';
import { LoadingRegion } from '../loading/loading-region';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { DataSyncLine } from '../ui/data-attribution';
import { useLoadingScope } from '../ui/loading-scope';
import { useTicketActions } from './hooks/use-ticket-actions';
import { useTicketsList } from './hooks/use-tickets-list';
import { TicketOpenForm } from './ticket-open-form';
import { TicketRow } from './ticket-row';
import type { AnyTicket, OptimisticTicket, TicketData } from './types';
import { isOptimistic } from './types';

/** The center's layout, read by the center and by its skeleton, so the skeleton is the center's size. */
const TICKET_CENTER_CLASS = 'flex flex-col gap-6';
const TICKET_LIST_BLOCK_CLASS = 'flex flex-col gap-2';
const TICKET_ROW_FRAME_CLASS = 'border-b border-ods-border last:border-b-0';
/**
 * Ticket rows the list's skeleton draws: what one screen shows under the open-ticket form (an 80px row; the form
 * leaves room for four on a 1440x900 desktop and, stacked, for two on a 390x844 phone).
 */
const TICKET_LIST_FOLD = { phone: 2, wide: 4 } as const;

export interface TicketCenterProps {
  /** Optional toast override (test-friendly). Defaults to the lib's
   *  shared toast singleton. */
  toast?: typeof defaultToast;
}

export function TicketCenter({ toast = defaultToast }: TicketCenterProps = {}) {
  // In a page's loading state nothing is read: no identity, no ticket list (the gate below owns those reads).
  if (useLoadingScope()) return <TicketCenterSkeleton />;
  return <TicketCenterGate toast={toast} />;
}

function TicketCenterGate({ toast }: { toast: typeof defaultToast }) {
  const identity = useChatIdentity();
  // Loading window — wait for the capability bag to resolve before
  // deciding what to render. `identity.isLoading` is the first-mount
  // window; once resolved we know authTier definitively.
  if (identity.isLoading) {
    return <TicketCenterSkeleton />;
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
    <div className={TICKET_CENTER_CLASS}>
      <TicketOpenForm
        onSubmit={input => actions.submitTicket(input)}
        isSubmitting={actions.isSubmittingForm}
        supportSystemDown={supportSystemDown}
      />

      <div className={TICKET_LIST_BLOCK_CLASS}>
        <TicketListHeader
          sync={syncInPage ? undefined : sync}
          syncLoading={isLoading}
          onRefresh={refetch}
          refreshing={isFetching}
        />

        {isLoading ? (
          <TicketListSkeleton />
        ) : merged.length === 0 ? (
          <Card className="p-6">
            <EmptyState
              type="generic"
              title="No tickets yet"
              description="Open one above to start the conversation."
              showCTA={false}
            />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            {merged.map(ticket => (
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
            ))}
          </Card>
        )}
      </div>
    </div>
  );
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

/**
 * The center while its identity and tickets are read: the open-ticket form drawn for real (static copy and empty
 * fields, inert: nothing can be typed before the identity is known), the list's real header with the sync line's
 * skeleton, and a fold of ticket row skeletons.
 */
function TicketCenterSkeleton({
  region = true,
}: {
  /** The loading state announces itself (`LoadingRegion`). `false` inside another loading region. Default `true`. */
  region?: boolean;
} = {}) {
  return (
    <LoadingRegion label="Loading tickets" announce={region} className={TICKET_CENTER_CLASS}>
      <div inert aria-hidden>
        <TicketOpenForm onSubmit={() => Promise.resolve(false)} isSubmitting={false} supportSystemDown={false} />
      </div>
      <div className={TICKET_LIST_BLOCK_CLASS}>
        <TicketListHeader sync={null} syncLoading />
        <TicketListSkeleton />
      </div>
    </LoadingRegion>
  );
}

function TicketListSkeleton() {
  return (
    <Card className="overflow-hidden">
      {Array.from({ length: Math.max(TICKET_LIST_FOLD.phone, TICKET_LIST_FOLD.wide) }, (_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows never reorder
          key={i}
          className={cn(
            TICKET_ROW_FRAME_CLASS,
            i >= TICKET_LIST_FOLD.phone && 'hidden md:block',
            i >= TICKET_LIST_FOLD.wide && 'md:hidden',
          )}
        >
          <ChatTicketItemSkeleton />
        </div>
      ))}
    </Card>
  );
}

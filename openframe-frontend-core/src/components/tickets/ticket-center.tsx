'use client'

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

import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import { Skeleton } from '../ui/skeleton'
import { EmptyState } from '../empty-state'
import { RefreshCw } from 'lucide-react'
import { useChatIdentity } from '../chat/hooks/use-chat-identity'
import { toast as defaultToast } from '../../hooks/use-toast'
import { formatRelativeTime } from '../../utils/date-utils'
import { devSectionAnchorId } from '../../utils/dev-sections/dev-section-param-keys'
import { TicketOpenForm } from './ticket-open-form'
import { TicketRow } from './ticket-row'
import { useTicketsList } from './hooks/use-tickets-list'
import { useTicketActions } from './hooks/use-ticket-actions'
import type { AnyTicket, OptimisticTicket, TicketData } from './types'
import { isOptimistic } from './types'

export interface TicketCenterProps {
  /** Optional toast override (test-friendly). Defaults to the lib's
   *  shared toast singleton. */
  toast?: typeof defaultToast
}

export function TicketCenter({ toast = defaultToast }: TicketCenterProps = {}) {
  const identity = useChatIdentity()
  // Loading window — wait for the capability bag to resolve before
  // deciding what to render. `identity.isLoading` is the first-mount
  // window; once resolved we know authTier definitively.
  if (identity.isLoading) {
    return <TicketCenterSkeleton />
  }
  if (identity.authTier === 'anon' || !identity.user?.email) {
    return (
      <EmptyState
        type="generic"
        title="Sign in to manage tickets"
        description="View, open, and follow up on support tickets after signing in."
        showCTA={false}
      />
    )
  }
  return (
    <TicketCenterAuthed
      toast={toast}
      sessionEmail={identity.user.email}
    />
  )
}

function TicketCenterAuthed({
  toast,
  sessionEmail,
}: {
  toast: typeof defaultToast
  /** Identity drilled from the parent — see `useTicketsList`'s
   *  `customerEmail` arg doc for the race-cause rationale. */
  sessionEmail: string
}) {
  const queryClient = useQueryClient()
  const { tickets, isLoading, isFetching, refetch, lastUpdatedAt } = useTicketsList({
    customerEmail: sessionEmail,
  })
  const [optimisticTickets, setOptimisticTickets] = useState<OptimisticTicket[]>([])
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null)
  const [supportSystemDown, setSupportSystemDown] = useState(false)

  // Optimistic cache management. Kept LOCAL (not in the query cache) so
  // a refetch doesn't blow away pending placeholders mid-flight. The
  // merged view is `[...optimistic, ...server]` so optimistic rows sit
  // at the top until they're explicitly removed.
  const prependOptimistic = useCallback((placeholder: OptimisticTicket) => {
    setOptimisticTickets((prev) => [placeholder, ...prev])
  }, [])
  const removeOptimistic = useCallback((placeholderId: string) => {
    setOptimisticTickets((prev) => prev.filter((t) => t.id !== placeholderId))
    // If the parent had this temp id expanded (shouldn't happen — the
    // drawer is hidden on optimistic rows — but defensive), null it
    // so we don't dangle a stale id.
    setExpandedTicketId((prev) => (prev === placeholderId ? null : prev))
  }, [])
  const removeTicketFromCache = useCallback(
    (ticketId: string) => {
      // Target every cache slot under the ['tickets'] prefix — the
      // queryKey now includes an identityKey segment (use-tickets-list)
      // so a bare ['tickets', 'self'] write would no-op silently.
      queryClient.setQueriesData<TicketData[] | undefined>(
        { queryKey: ['tickets'] },
        (prev) => (prev ?? []).filter((t) => t.id !== ticketId),
      )
      setExpandedTicketId((prev) => (prev === ticketId ? null : prev))
    },
    [queryClient],
  )

  const actions = useTicketActions({
    prependOptimistic,
    removeOptimistic,
    removeTicketFromCache,
    toast,
    onSupportSystemDown: () => setSupportSystemDown(true),
  })

  const toggleRow = useCallback((id: string) => {
    setExpandedTicketId((prev) => (prev === id ? null : id))
  }, [])

  const merged: AnyTicket[] = [...optimisticTickets, ...tickets]

  return (
    <div className="flex flex-col gap-6">
      <TicketOpenForm
        onSubmit={(input) => actions.submitTicket(input)}
        isSubmitting={actions.isSubmittingForm}
        supportSystemDown={supportSystemDown}
      />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-h5 text-ods-text-secondary">
            Your Current Tickets
          </p>
          <div className="flex items-center gap-3 text-h6 text-ods-text-secondary">
            {lastUpdatedAt && (
              <span>Updated {formatRelativeTime(new Date(lastUpdatedAt))}</span>
            )}
            <Button
              type="button"
              variant="transparent"
              size="small"
              onClick={refetch}
              disabled={isFetching}
              aria-label="Refresh ticket list"
              leftIcon={<RefreshCw className="h-4 w-4" />}
            />
          </div>
        </div>

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
            {merged.map((ticket) => (
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
  )
}

function TicketCenterSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <Skeleton className="h-7 w-48 mb-4" />
        <Skeleton className="h-10 w-full mb-3" />
        <Skeleton className="h-24 w-full" />
      </Card>
      <TicketListSkeleton />
    </div>
  )
}

function TicketListSkeleton() {
  return (
    <Card className="overflow-hidden">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 px-4 flex items-center gap-4 border-b border-ods-border last:border-b-0">
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
          </div>
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </Card>
  )
}

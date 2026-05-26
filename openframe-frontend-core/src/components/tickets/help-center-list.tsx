'use client'

/**
 * `<HelpCenterList />` — the full Help Center surface (the openframe
 * `/tickets` page mounts this directly; third-party embedders can mount
 * it inside their own `<PageShell>` to get the same UX).
 *
 * Mounts `<DevSectionPage sectionKey="tickets">` so the page chrome
 * (hero + search + status filter + back button) is identical to
 * `/roadmap`, `/bug-fixes-and-enhancements`, `/releases`. The
 * "Open a new ticket" form lives in the new `preControls` slot above
 * the search/filter row.
 *
 * State ownership:
 *   - URL params (`?search=`, `?status=`, `?page=`) → `DevSectionView`
 *     writes search + status, `<UnifiedPagination>` writes page.
 *     `useTicketsList({ search, status, page })` reads them.
 *   - Optimistic placeholders → kept LOCAL (not in TanStack cache) so a
 *     refetch (URL filter change) doesn't blow them away mid-flight.
 *   - Expanded row → single id (only one drawer open at a time).
 *   - Mutations → `useTicketActions` with prepend/remove callbacks
 *     wired to the local placeholder state.
 *
 * Anon visitors get the same `DevSectionPage` chrome (hero + back
 * button) but with a single "Sign in" `<EmptyState>` body — no form,
 * no list, no fetch.
 */

import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useRouter, usePathname } from '../../embed-shims'
import { Button } from '../ui'
import { EmptyState } from '../empty-state'
import { DevSectionPage } from '../shared/dev-section'
import { DevCardRowSkeletonList } from '../shared/dev-section/dev-card-row'
import { UnifiedPagination } from '../unified-pagination'
import { useChatIdentity } from '../chat/hooks/use-chat-identity'
import { toast as defaultToast } from '../../hooks/use-toast'
import { useTicketsList } from './hooks/use-tickets-list'
import { useTicketActions } from './hooks/use-ticket-actions'
import { HelpCenterCard } from './help-center-card'
import { HelpCenterCreateForm } from './help-center-create-form'
import type { AnyTicket, OptimisticTicket, TicketData } from './types'
import { isOptimistic } from './types'

export interface HelpCenterListProps {
  /** Toast override (test-friendly). Defaults to the lib's shared
   *  toast singleton. */
  toast?: typeof defaultToast
}

export function HelpCenterList({ toast = defaultToast }: HelpCenterListProps = {}) {
  const identity = useChatIdentity()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || 'all'
  // 1-based page from the URL. `<UnifiedPagination>` writes `?page=N`
  // on navigation; we read it here and re-fetch on change. Invalid
  // values fall back to page 1.
  const rawPage = Number(searchParams.get('page'))
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1

  // Identity gate FIRST — anon visitors skip every fetch + hook below.
  // `useChatIdentity` has a brief `isLoading` window on first render
  // before the identity resolves; we render the skeleton until it lands
  // to avoid flashing the sign-in EmptyState for authed users.
  if (identity.isLoading) {
    return (
      <DevSectionPage sectionKey="tickets">
        <DevCardRowSkeletonList />
      </DevSectionPage>
    )
  }
  if (identity.authTier === 'anon' || !identity.user?.email) {
    return (
      <DevSectionPage sectionKey="tickets">
        <EmptyState
          type="generic"
          title="Sign in to manage tickets"
          description="View, open, and follow up on support tickets after signing in."
          showCTA={false}
        />
      </DevSectionPage>
    )
  }

  return (
    <HelpCenterListAuthed
      search={search}
      status={status}
      page={page}
      searchParams={searchParams}
      router={router}
      pathname={pathname}
      toast={toast}
    />
  )
}

interface AuthedProps {
  search: string
  status: string
  page: number
  searchParams: ReturnType<typeof useSearchParams>
  router: ReturnType<typeof useRouter>
  pathname: string
  toast: typeof defaultToast
}

function HelpCenterListAuthed({
  search,
  status,
  page,
  searchParams,
  router,
  pathname,
  toast,
}: AuthedProps) {
  const queryClient = useQueryClient()
  const { tickets, isLoading, isFetching, error, refetch, totalPages } = useTicketsList({
    search,
    status,
    page,
  })

  const [optimisticTickets, setOptimisticTickets] = useState<OptimisticTicket[]>([])
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null)
  const [supportSystemDown, setSupportSystemDown] = useState(false)

  // Optimistic cache management. Kept LOCAL (not in the query cache) so
  // a refetch (e.g. URL-filter change) doesn't blow away pending
  // placeholders. Merged view is `[...optimistic, ...server]` so
  // placeholders sit at the top until they're explicitly removed.
  const prependOptimistic = useCallback((placeholder: OptimisticTicket) => {
    setOptimisticTickets((prev) => [placeholder, ...prev])
  }, [])
  const removeOptimistic = useCallback((placeholderId: string) => {
    setOptimisticTickets((prev) => prev.filter((t) => t.id !== placeholderId))
    setExpandedTicketId((prev) => (prev === placeholderId ? null : prev))
  }, [])
  const removeTicketFromCache = useCallback(
    (ticketId: string) => {
      // Every cache slot under the ['tickets'] prefix — the queryKey
      // includes search + status + page + pageSize segments so a bare
      // write would miss most slots.
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
  const hasActiveFilters = search !== '' || (status !== '' && status !== 'all')
  const hasResults = merged.length > 0

  const form = (
    <HelpCenterCreateForm
      onSubmit={actions.submitTicket}
      supportSystemDown={supportSystemDown}
    />
  )

  const body = (
    <div className="w-full flex flex-col gap-[40px]">
      {error && (
        <div className="bg-ods-card border border-ods-border rounded-[6px] p-[40px] text-center w-full flex flex-col items-center gap-3">
          <p className="text-ods-error text-base">
            Couldn&rsquo;t load your tickets. {error.message}
          </p>
          <Button type="button" variant="accent" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {!error && (
        <div className="w-full">
          {isLoading ? (
            <DevCardRowSkeletonList />
          ) : !hasResults && isFetching ? (
            // Bridge state — background refetch in flight and the
            // optimistic placeholder was just removed by the mutation
            // callback. Without this branch "No tickets yet" would flash
            // for ~50ms between `removeOptimistic` and the server
            // response landing.
            <DevCardRowSkeletonList rows={1} />
          ) : !hasResults ? (
            hasActiveFilters ? (
              <EmptyState
                type="search"
                title="No tickets found"
                description="No tickets match your current filters. Try clearing them or broadening your search."
                showCTA
                ctaText="Reset filters"
                onCtaClick={() => {
                  const params = new URLSearchParams(searchParams.toString())
                  params.delete('search')
                  params.delete('status')
                  router.replace(`${pathname}?${params.toString()}`, { scroll: false })
                }}
              />
            ) : (
              <EmptyState
                type="generic"
                title="No tickets yet"
                description="Open one above to start the conversation with the support team."
                showCTA={false}
              />
            )
          ) : (
            <div className="bg-ods-card border border-ods-border rounded-[6px] overflow-hidden w-full">
              {merged.map((ticket) => (
                <HelpCenterCard
                  key={ticket.id}
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
            </div>
          )}
        </div>
      )}

      {/* Pagination — `<UnifiedPagination>` owns the URL `?page=N`
          rewrite on click; we just feed it the server-echoed current
          page + totalPages. Hidden when there's at most one page so
          the list doesn't reserve vertical space when it isn't
          actionable. */}
      {!error && totalPages > 1 && (
        <UnifiedPagination currentPage={page} totalPages={totalPages} />
      )}
    </div>
  )

  return (
    <DevSectionPage sectionKey="tickets" preControls={form}>
      {body}
    </DevSectionPage>
  )
}

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
import { useScrollToHash } from '../../hooks/use-scroll-to-hash'
import { STICKY_HEADER_OFFSET_PX } from '../../utils/same-page-hash-nav'
import { devSectionAnchorId } from '../../utils/dev-sections/dev-section-param-keys'
import { toast as defaultToast } from '../../hooks/use-toast'
import { useTicketsList } from './hooks/use-tickets-list'
import { useTicketActions } from './hooks/use-ticket-actions'
import { HelpCenterCard } from './help-center-card'
import { HelpCenterCreateForm, HelpCenterCreateFormSkeleton } from './help-center-create-form'
import type { AnyTicket, OptimisticTicket, TicketsCacheSlot } from './types'
import { isOptimistic, TICKET_LIVE_POLL_MS } from './types'

export interface HelpCenterListProps {
  /** Toast override (test-friendly). Defaults to the lib's shared
   *  toast singleton. */
  toast?: typeof defaultToast
  /** Back-button forwarded to the internal `DevSectionPage` chrome (same shape
   *  as `DevSectionPage` / `LegalDocumentPage`: `{ label?, href? }`, or `false`
   *  to hide). Omit ⇒ `DevSectionPage`'s default (`Back to home` → `/`), which
   *  embedders whose home isn't `/` MUST override. */
  backButton?: { label?: string; href?: string } | false
  /** Override the hero title (forwarded to `DevSectionPage.title`). Defaults to
   *  the `tickets` section copy ("Help Center"). Set this to brand the surface
   *  for an embed that wants its own label (e.g. "Support Tickets"). */
  title?: string
  /** Render the standalone `<PageShell>` (forwarded to the internal
   *  `DevSectionPage`). Default true. Pass false when the host layout already
   *  provides the page container (avoids a nested `<main>`). */
  shell?: boolean
}

export function HelpCenterList({ toast = defaultToast, backButton, title, shell }: HelpCenterListProps = {}) {
  const identity = useChatIdentity()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || 'all'
  // Deep-link: `?ticket=<external_id>` auto-opens that ticket's drawer on load.
  // Same GET-param plumbing as `?search=` — read here, drilled to the authed
  // child which expands the matching row once it's in the fetched list.
  const ticketParam = searchParams.get('ticket') || ''
  // 1-based page from the URL. `<UnifiedPagination>` writes `?page=N`
  // on navigation; we read it here and re-fetch on change. Invalid
  // values fall back to page 1.
  const rawPage = Number(searchParams.get('page'))
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1

  // Identity gate FIRST — anon visitors skip every fetch + hook below.
  // `useChatIdentity` has a brief `isLoading` window on first render
  // before the identity resolves; we render the skeleton until it lands
  // to avoid flashing the sign-in EmptyState for authed users. The
  // skeleton mirrors the AUTHED layout — form placeholder above the
  // search/filter row, list-rows skeleton below — so the chrome
  // doesn't shift vertically when identity resolves and the real form
  // mounts in the `preControls` slot.
  if (identity.isLoading) {
    return (
      <DevSectionPage
        sectionKey="tickets"
        backButton={backButton}
        title={title}
        shell={shell}
        preControls={<HelpCenterCreateFormSkeleton />}
      >
        <DevCardRowSkeletonList />
      </DevSectionPage>
    )
  }
  if (identity.authTier === 'anon' || !identity.user?.email) {
    return (
      <DevSectionPage sectionKey="tickets" backButton={backButton} title={title} shell={shell}>
        <EmptyState
          type="generic"
          title="Sign in to manage tickets"
          description="View, open, and follow up on support tickets after signing in."
          showCTA={false}
        />
      </DevSectionPage>
    )
  }

  // Identity is loaded + has an email (gated above). Resolve the
  // authoritative session display name + email HERE so the create-form
  // child doesn't have to call `useChatIdentity` itself — that hook is
  // a plain `useState`+`useEffect` (no shared cache), so a second call
  // in the child would race the first render and lock RHF's
  // `defaultValues.email` to '' for the form's lifetime.
  const sessionName =
    [identity.user?.firstName, identity.user?.lastName].filter(Boolean).join(' ').trim() ||
    identity.user?.email?.split('@')[0] ||
    'Customer'
  const sessionEmail = identity.user!.email!

  return (
    <HelpCenterListAuthed
      search={search}
      status={status}
      page={page}
      ticketParam={ticketParam}
      searchParams={searchParams}
      router={router}
      pathname={pathname}
      toast={toast}
      sessionName={sessionName}
      sessionEmail={sessionEmail}
      backButton={backButton}
      title={title}
      shell={shell}
    />
  )
}

interface AuthedProps {
  search: string
  status: string
  page: number
  /** `?ticket=<external_id>` deep-link target — auto-opens that drawer. */
  ticketParam: string
  searchParams: ReturnType<typeof useSearchParams>
  router: ReturnType<typeof useRouter>
  pathname: string
  toast: typeof defaultToast
  sessionName: string
  sessionEmail: string
  backButton?: { label?: string; href?: string } | false
  title?: string
  shell?: boolean
}

function HelpCenterListAuthed({
  search,
  status,
  page,
  ticketParam,
  searchParams,
  router,
  pathname,
  toast,
  sessionName,
  sessionEmail,
  backButton,
  title,
  shell,
}: AuthedProps) {
  const queryClient = useQueryClient()
  const [optimisticTickets, setOptimisticTickets] = useState<OptimisticTicket[]>([])
  const [supportSystemDown, setSupportSystemDown] = useState(false)

  // SINGLE source of truth for "which ticket is open" = the `?ticket=<external_id>`
  // URL param (same model as `?search=` / `?status=`). Click-to-open and the
  // deep-link path are now ONE code path: a click writes the param, the drawer's
  // open state is DERIVED from the param. No separate `expandedTicketId` state,
  // no auto-open effect, no re-open guard — opening, closing, deep-linking, and
  // sharing a URL all flow through the same param.
  const setOpenTicket = useCallback(
    (externalId: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (externalId) params.set('ticket', externalId)
      else params.delete('ticket')
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [searchParams, router, pathname],
  )

  const { tickets, isLoading, isFetching, error, refetch, totalPages } = useTicketsList({
    // `sessionEmail` is drilled in from the parent — see the same
    // pattern + race-cause rationale documented in
    // `HelpCenterCreateForm.sessionName/sessionEmail`. Calling
    // `useChatIdentity` inside `useTicketsList` would race the
    // parent's already-resolved identity and produce an empty-state
    // flash on first render.
    customerEmail: sessionEmail,
    search,
    status,
    page,
    // Live status: while a drawer is open, poll so an out-of-band HubSpot
    // status change (e.g. agent closes the ticket) flips the badge +
    // open/reopen affordance within one interval. Idle (no drawer) → no poll.
    // `ticketParam` (the open ticket's external_id) is the open signal.
    refetchInterval: ticketParam ? TICKET_LIVE_POLL_MS : false,
  })

  // Open state DERIVED from the URL param. `?ticket=` carries the user-facing
  // `external_id`; map it to the internal row id the card matches on. Resolves
  // to null until the ticket lands in the fetched list (deep-link cold load) and
  // auto-collapses if the open ticket disappears (e.g. TICKET_NOT_FOUND removal).
  const expandedTicketId =
    (ticketParam && tickets.find((t) => t.external_id === ticketParam)?.id) || null

  // Optimistic cache management. Kept LOCAL (not in the query cache) so
  // a refetch (e.g. URL-filter change) doesn't blow away pending
  // placeholders. Merged view is `[...optimistic, ...server]` so
  // placeholders sit at the top until they're explicitly removed.
  const prependOptimistic = useCallback((placeholder: OptimisticTicket) => {
    setOptimisticTickets((prev) => [placeholder, ...prev])
  }, [])
  const removeOptimistic = useCallback((placeholderId: string) => {
    setOptimisticTickets((prev) => prev.filter((t) => t.id !== placeholderId))
    // No drawer-collapse needed: optimistic placeholders have no `external_id`,
    // so they can never be the URL-derived open ticket.
  }, [])
  const removeTicketFromCache = useCallback(
    (ticketId: string) => {
      // Every cache slot under the ['tickets'] prefix — the queryKey
      // includes search + status + page + pageSize segments so a bare
      // write would miss most slots.
      //
      // Cache slot is `TicketsCacheSlot` (`{ tickets, count, … }`), NOT
      // a bare `TicketData[]`. The previous version called `.filter()`
      // directly on the object — silently crashing only on the rare
      // TICKET_NOT_FOUND path; the prod regression that landed
      // 2026-05-29 surfaced the same shape mismatch in the
      // close/reopen optimistic-update path. Project, filter, reassemble.
      queryClient.setQueriesData<TicketsCacheSlot | undefined>(
        { queryKey: ['tickets'] },
        (prev) => {
          if (!prev || !Array.isArray(prev.tickets)) return prev
          const nextTickets = prev.tickets.filter((t) => t.id !== ticketId)
          if (nextTickets.length === prev.tickets.length) return prev
          return { ...prev, tickets: nextTickets }
        },
      )
      // The drawer auto-collapses on its own: once the ticket leaves the list,
      // the URL-derived `expandedTicketId` finds no match → null. No state to clear.
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

  // Toggle = write the URL param (open) or clear it (close). The clicked card's
  // internal id maps to its `external_id` for the param; optimistic rows (no
  // external_id) aren't expandable so they short-circuit. This is the ONE open
  // path — a click, a deep link, and a shared URL are indistinguishable.
  const toggleRow = useCallback(
    (id: string) => {
      const t = tickets.find((x) => x.id === id)
      if (!t?.external_id) return
      setOpenTicket(t.external_id === ticketParam ? null : t.external_id)
    },
    [tickets, ticketParam, setOpenTicket],
  )

  const merged: AnyTicket[] = [...optimisticTickets, ...tickets]

  // Deep-link hash dispatch — `/tickets#ticket-<external_id>` from a
  // chat card (or any other in-app link). The `?ticket=<external_id>`
  // query param keeps owning drawer auto-open; this hook owns the
  // scroll-to-row independently. Both can fire on the same URL
  // (`/tickets?ticket=X#ticket-X`) — drawer opens AND row scrolls into
  // view. Shared `useScrollToHash` polls until the row mounts (handles
  // the SWR fetch race), uses the canonical `scrollElementIntoView` tween.
  useScrollToHash(tickets, { headerOffset: STICKY_HEADER_OFFSET_PX })
  const hasActiveFilters = search !== '' || (status !== '' && status !== 'all')
  const hasResults = merged.length > 0

  // Form is the canonical lib `<ContactForm>` (NOT a new ticket-specific
  // form) — we hide every contact-only field, supply the customer's
  // identity from `useChatIdentity` so Zod's name+email validators
  // pass, slot a Subject `<Input>` into the new `extraTopField`
  // position, and forward submission through `actions.submitTicket`.
  // Same primitives, same wrapper styling, same visual treatment as
  // every other primary form in the app.
  const form = (
    <HelpCenterCreateForm
      actions={actions}
      sessionName={sessionName}
      sessionEmail={sessionEmail}
      supportSystemDown={supportSystemDown}
    />
  )

  const body = (
    <div className="w-full flex flex-col gap-[40px]">
      {error && (
        <div className="bg-ods-card border border-ods-border rounded-[6px] p-[40px] text-center w-full flex flex-col items-center gap-3">
          <p className="text-ods-error text-h6">
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
            // `overflow-clip` (NOT `overflow-hidden`) — both visually
            // clip the rounded corners, but `hidden` makes the element
            // a "scroll container" per CSSOM spec, which causes
            // `scrollIntoView` calls inside (`<HelpCenterCard>` click
            // handlers) to try scrolling THIS div (can't, overflow
            // hidden) instead of bubbling up to the window. `clip`
            // keeps the visual clip but NOT the scroll-container
            // status, so click-to-scroll actually moves the page.
            <div className="bg-ods-card border border-ods-border rounded-[6px] overflow-clip w-full">
              {merged.map((ticket) => (
                <HelpCenterCard
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
                  onActionCollapsed={() => setOpenTicket(null)}
                  replyError={actions.replyErrorFor(ticket.external_id)}
                  onClearReplyError={() => actions.clearReplyError(ticket.external_id)}
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
    <DevSectionPage sectionKey="tickets" backButton={backButton} title={title} shell={shell} preControls={form}>
      {body}
    </DevSectionPage>
  )
}

'use client'

/**
 * `<RoadmapView />` — the SELF-CONTAINED roadmap LIST surface.
 *
 * Fetches the roadmap list via the shared `useSelfFetch` hook and renders the
 * pure controlled `<RoadmapGrid>` (kept controlled so related-content rails can
 * still pass `items`). The host configures only **api routes**: the list
 * `endpoint` (default `/api/roadmap`), the per-task `buildRefreshUrl`, and the
 * vote endpoint via `votingOptions`. Optional `initialItems` hydrates SSR.
 */

import { useEffect, useMemo } from 'react'

import { useSearchParams } from '../../../embed-shims'
import { LoadError } from '../../ui/error-state'
import { useSelfFetch } from '../../../hooks/use-self-fetch'
import type { RoadmapItem } from '../../chat/types/entities/roadmap-item'
import { RoadmapGrid } from './roadmap-grid'
import { RoadmapGridSkeleton } from './roadmap-grid-skeleton'
import type { UseRoadmapVotingOptions } from './use-roadmap-voting'
import { DEV_SECTION_PARAM_KEYS } from '../../../utils/dev-sections/dev-section-param-keys'
import { scrollElementIntoView } from '../../../utils/scroll-into-view'

const DEFAULT_ENDPOINT = '/api/roadmap'
// Defaults sourced from the ONE param-key registry the chrome (OPENFRAME_DEV_SECTIONS) also
// reads, so the chrome's written `?key=` and this view's read can't silently diverge.
const DEFAULT_SEARCH_PARAM_KEY = DEV_SECTION_PARAM_KEYS.search
const DEFAULT_STATUS_PARAM_KEY = DEV_SECTION_PARAM_KEYS.status

export interface RoadmapViewProps {
  /** GET list endpoint (the api route). Returns `{ items }`. Default
   *  `/api/roadmap`. */
  endpoint?: string
  /** Optional SSR hydrate — skips the initial client fetch. */
  initialItems?: RoadmapItem[]
  showLeftMargin?: boolean
  /** Per-task refresh URL builder (after a vote). Default `/api/roadmap/<id>`. */
  buildRefreshUrl?: (taskId: string) => string
  /** Voting hook options (vote endpoint + storage key). */
  votingOptions?: UseRoadmapVotingOptions
  /** URL param key for the search input — MUST match the section chrome
   *  (`DevSectionView`) that writes it. Default `'search'`. */
  searchParamKey?: string
  /** URL param key for the status filter. Default `'status'` (the roadmap
   *  section's `filter.paramKey`). `'all'` means no filter. */
  statusParamKey?: string
}

export function RoadmapView({
  endpoint = DEFAULT_ENDPOINT,
  initialItems,
  showLeftMargin,
  buildRefreshUrl,
  votingOptions,
  searchParamKey = DEFAULT_SEARCH_PARAM_KEY,
  statusParamKey = DEFAULT_STATUS_PARAM_KEY,
}: RoadmapViewProps = {}) {
  // Read the search + status params the section chrome (`DevSectionView`) writes
  // and fold them INTO the fetch url so the url IS the cache key — the list
  // refetches filtered whenever the controls change. Mirrors `ProductReleasesView`.
  const searchParams = useSearchParams()
  const search = searchParams.get(searchParamKey) || ''
  const status = searchParams.get(statusParamKey) || 'all'
  const listParams = new URLSearchParams()
  if (search) listParams.set(searchParamKey, search)
  if (status && status !== 'all') listParams.set(statusParamKey, status)
  const qs = listParams.toString()
  const url = qs ? `${endpoint}?${qs}` : endpoint

  // Memoize so the SSR `initialItems` wrapper keeps a STABLE identity — else the
  // hook's initialData re-sync effect fires every render and clobbers the
  // optimistic vote patch below.
  const initialData = useMemo(() => (initialItems ? { items: initialItems } : undefined), [initialItems])
  const { data, setData, isLoading, error, reload } = useSelfFetch<{ items?: RoadmapItem[] }>(
    url,
    { initialData },
  )
  const items = data?.items ?? []

  // Deep-link hash dispatch — `?search=<id>#roadmap-<id>` from a chat card.
  // After items render, scroll the card with the matching DOM id into
  // view (sticky-header offset 96 — same value `useNavLink`'s hash scroll
  // uses so the card lands BELOW the sticky chrome). Re-runs on
  // `hashchange` (browser back/forward + synthetic dispatch from
  // `navigateSamePageHash`) so repeat clicks re-scroll.
  //
  // RACE NOTE: roadmap-grid renders cards inside Radix `<AccordionItem>`s,
  // and Radix UNMOUNTS the contents of a collapsed accordion. On first
  // paint every quarter is collapsed; an effect in `roadmap-grid.tsx`
  // then expands every quarter when `hasActiveFilters` is true (which
  // it is when the chat URL carries `?search=<id>`). So when our hash
  // dispatch runs the moment items first arrive, `getElementById`
  // returns null because the card isn't in the DOM yet — the accordion
  // is still expanding. Naive `useEffect([items.length])` ran once and
  // gave up. Poll the DOM via `requestAnimationFrame` for ~1 second
  // (60 frames) until the row appears, then scroll. Cheap (no DOM
  // mutation observer) and SSR-safe. The poll terminates as soon as
  // the target exists OR we exhaust the frame budget — same retry
  // pattern other React apps use for "wait for async-mounted child."
  useEffect(() => {
    if (items.length === 0) return
    const tryScrollToHash = () => {
      const hash = window.location.hash.slice(1)
      if (!hash) return
      let frames = 0
      const tick = () => {
        const el = document.getElementById(hash)
        if (el) {
          scrollElementIntoView(el, { headerOffset: 96 })
          return
        }
        if (frames++ < 60) requestAnimationFrame(tick)
      }
      tick()
    }
    tryScrollToHash()
    window.addEventListener('hashchange', tryScrollToHash)
    return () => window.removeEventListener('hashchange', tryScrollToHash)
  }, [items.length])

  if (error) {
    return <LoadError message="Failed to load roadmap." onRetry={reload} />
  }
  // Skeleton only while the FIRST fetch is in flight (no data yet) — a malformed
  // body lacking `items` renders the grid (empty), never a stuck skeleton.
  if (isLoading && !data) {
    return <RoadmapGridSkeleton showLeftMargin={showLeftMargin} />
  }

  return (
    <RoadmapGrid
      items={items}
      showLeftMargin={showLeftMargin}
      buildRefreshUrl={buildRefreshUrl}
      votingOptions={votingOptions}
      // Full-page roadmap → collapsible quarter grouping (the shared RoadmapGrid
      // capability; flat grids stay the RoadmapGrid default). When the chrome's
      // search / status filter is active, expand every quarter so matches aren't hidden.
      groupByQuarter
      hasActiveFilters={search !== '' || status !== 'all'}
      // After a vote refreshes a single task, patch it into the fetched list so
      // the displayed counts stay live.
      onItemUpdate={(updated) =>
        setData((prev) =>
          prev
            ? { ...prev, items: (prev.items ?? []).map((it) => (it.id === updated.id ? updated : it)) }
            : prev,
        )
      }
    />
  )
}

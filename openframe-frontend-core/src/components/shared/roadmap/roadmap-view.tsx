'use client'

/**
 * `<RoadmapView />` — the SELF-CONTAINED roadmap LIST surface.
 *
 * Fetches the roadmap list internally (the `DeliveryLists` pattern: plain
 * `fetch` + `useEffect`/`useState`, no react-query dep) and renders the pure
 * `<RoadmapGrid>` (kept controlled so related-content rails can still pass
 * `items`). The host configures only **api routes**: the list `endpoint`
 * (default `/api/roadmap`), the per-task `buildRefreshUrl`, and the vote
 * endpoint via `votingOptions`. Optional `initialItems` hydrates SSR.
 */

import { useEffect, useRef, useState } from 'react'

import type { RoadmapItem } from '../../chat/types/entities/roadmap-item'
import { LoadError } from '../../ui/error-state'
import { RoadmapGrid } from './roadmap-grid'
import { RoadmapGridSkeleton } from './roadmap-grid-skeleton'
import type { UseRoadmapVotingOptions } from './use-roadmap-voting'

const DEFAULT_ENDPOINT = '/api/roadmap'

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
}

export function RoadmapView({
  endpoint = DEFAULT_ENDPOINT,
  initialItems,
  showLeftMargin,
  buildRefreshUrl,
  votingOptions,
}: RoadmapViewProps = {}) {
  const [items, setItems] = useState<RoadmapItem[] | null>(initialItems ?? null)
  const [isLoading, setIsLoading] = useState(!initialItems)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const skipFirstFetch = useRef(!!initialItems)

  useEffect(() => {
    if (skipFirstFetch.current) {
      skipFirstFetch.current = false
      return
    }
    let cancelled = false
    async function load() {
      try {
        setIsLoading(true)
        setError(false)
        const res = await fetch(endpoint)
        if (!res.ok) throw new Error(`Request failed (${res.status})`)
        const json = (await res.json()) as { items?: RoadmapItem[] }
        if (!cancelled) setItems(json.items ?? [])
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [endpoint, reloadKey])

  if (error) {
    return <LoadError message="Failed to load roadmap." onRetry={() => setReloadKey((k) => k + 1)} />
  }
  if (isLoading || !items) {
    return <RoadmapGridSkeleton showLeftMargin={showLeftMargin} />
  }

  return (
    <RoadmapGrid
      items={items}
      showLeftMargin={showLeftMargin}
      buildRefreshUrl={buildRefreshUrl}
      votingOptions={votingOptions}
      // After a vote refreshes a single task, patch it into the local list so
      // the displayed counts stay live (replaces the host's onItemUpdate +
      // list-refetch dance).
      onItemUpdate={(updated) =>
        setItems((prev) => (prev ? prev.map((it) => (it.id === updated.id ? updated : it)) : prev))
      }
    />
  )
}

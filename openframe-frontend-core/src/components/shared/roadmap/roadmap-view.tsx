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

import { useMemo } from 'react'

import { LoadError } from '../../ui/error-state'
import { useSelfFetch } from '../../../hooks/use-self-fetch'
import type { RoadmapItem } from '../../chat/types/entities/roadmap-item'
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
  // Memoize so the SSR `initialItems` wrapper keeps a STABLE identity — else the
  // hook's initialData re-sync effect fires every render and clobbers the
  // optimistic vote patch below.
  const initialData = useMemo(() => (initialItems ? { items: initialItems } : undefined), [initialItems])
  const { data, setData, isLoading, error, reload } = useSelfFetch<{ items?: RoadmapItem[] }>(
    endpoint,
    { initialData },
  )
  const items = data?.items ?? []

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

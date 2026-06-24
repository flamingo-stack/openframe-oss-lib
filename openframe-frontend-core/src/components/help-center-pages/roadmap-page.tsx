'use client'

/**
 * `<RoadmapPage>` — the full `/roadmap` page: `DevSectionPage sectionKey="roadmap"`
 * (PageShell + PageLayout + hero + search/status chrome) wrapping the
 * self-contained `<RoadmapView>` list. Hosts configure only the api routes
 * (+ optional SSR `initialItems`); both openframe-frontend and the hub mount
 * this instead of hand-composing `DevSectionPage` + `RoadmapView`.
 */

import type { ReactNode } from 'react'
import type { RoadmapItem } from '../chat/types/entities/roadmap-item'
import { DevSectionPage } from '../shared/dev-section'
import { RoadmapView } from '../shared/roadmap'
import type { UseRoadmapVotingOptions } from '../shared/roadmap'

export interface RoadmapPageProps {
  /** GET list endpoint (the api route). Default `/api/roadmap`. */
  roadmapEndpoint?: string
  /** Per-task refresh URL builder (after a vote). Default `/api/roadmap/<id>`. */
  buildRefreshUrl?: (taskId: string) => string
  /** Vote POST endpoint, forwarded to `RoadmapView` via `votingOptions`. */
  voteApiEndpoint?: string
  /** Full voting options override — takes precedence over `voteApiEndpoint`. */
  votingOptions?: UseRoadmapVotingOptions
  /** Optional SSR hydrate (hub server-fetch) — skips the initial client fetch. */
  initialItems?: RoadmapItem[]
  /** Indent the grid (the hub's full-page roadmap look). Default off. */
  showLeftMargin?: boolean
  /** Back-button config. Pass `false` to hide. Default `{ href: '/' }`. */
  backButton?: { label?: string; href?: string } | false
  /** Override the hero title/subtitle (defaults from `OPENFRAME_DEV_SECTIONS`). */
  title?: string
  subtitle?: string
  /** Optional slot rendered below the list, inside the page chrome — e.g. the
   *  hub's related-content rail. */
  belowContent?: ReactNode
  /** Render the standalone `<PageShell>`. Default true. Pass false when the host
   *  layout already provides the page container (forwarded to `DevSectionPage`). */
  shell?: boolean
}

export function RoadmapPage({
  roadmapEndpoint,
  buildRefreshUrl,
  voteApiEndpoint,
  votingOptions,
  initialItems,
  showLeftMargin,
  backButton,
  title,
  subtitle,
  belowContent,
  shell,
}: RoadmapPageProps) {
  return (
    <DevSectionPage sectionKey="roadmap" backButton={backButton} title={title} subtitle={subtitle} shell={shell}>
      <RoadmapView
        endpoint={roadmapEndpoint}
        initialItems={initialItems}
        showLeftMargin={showLeftMargin}
        buildRefreshUrl={buildRefreshUrl}
        votingOptions={votingOptions ?? (voteApiEndpoint ? { voteApiEndpoint } : undefined)}
      />
      {belowContent}
    </DevSectionPage>
  )
}

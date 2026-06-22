import React from 'react'
import { AdminContentCard } from './admin-content-card'
import { formatEntryMonthUTC } from '../../../utils/format'
import { getProxiedImageUrl } from '../../../utils/image-proxy-stub'

/** Minimal row shape the card renders. Both the hub dashboard entry and the
 *  related-content hydrated row satisfy it structurally. */
export interface WhatIShippedCardData {
  title?: string | null
  summary?: string | null
  status?: string | null
  featured_image?: string | null
  main_video_thumbnail?: string | null
  entry_month?: string | null
  author?: { full_name?: string | null; avatar_url?: string | null } | null
}

export interface WhatIShippedCardProps {
  entry: WhatIShippedCardData
  /** OG fallback cover. Caller computes it (hub: `useOgPlaceholderUrl`; related
   *  rail: `extras.buildOgPlaceholderUrl`). */
  placeholderUrl?: string | null
  /** Owner action row (dashboard). Omit for a read-only card. */
  actions?: React.ReactNode
  /** When provided, the WHOLE card becomes a link (related-rail click-through).
   *  Don't combine with `actions` (nested interactive). */
  anchorProps?: React.AnchorHTMLAttributes<HTMLAnchorElement>
  className?: string
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  published: 'bg-ods-success-secondary text-ods-success',
  draft: 'bg-ods-warning-secondary text-ods-warning',
  archived: 'bg-ods-border text-ods-text-secondary',
}

/**
 * THE single "What I Shipped" card. Wraps `AdminContentCard` with the canonical
 * mapping (cover = featured_image || main_video_thumbnail, OG placeholder
 * fallback, title, 140-char summary, status badge, author avatar+name +
 * reporting month). Used by BOTH the people-hub dashboard (with owner `actions`)
 * and the related-content rail (with `anchorProps` for click-through), so the
 * card is byte-identical everywhere — one component, one mapping, no drift.
 */
export function WhatIShippedCard({ entry, placeholderUrl, actions, anchorProps, className }: WhatIShippedCardProps) {
  const month = formatEntryMonthUTC(entry.entry_month, 'short')
  const card = (
    <AdminContentCard
      imageUrl={entry.featured_image || entry.main_video_thumbnail}
      placeholderUrl={placeholderUrl}
      title={entry.title || 'Untitled entry'}
      summary={(entry.summary ?? '').slice(0, 140) || 'No description'}
      badges={
        entry.status ? (
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${
              STATUS_BADGE_CLASS[entry.status] ?? 'bg-ods-card border border-ods-border text-ods-text-secondary'
            }`}
          >
            {entry.status}
          </span>
        ) : null
      }
      meta={
        <>
          <span className="flex items-center gap-2 min-w-0">
            {entry.author?.avatar_url ? (
              <img src={getProxiedImageUrl(entry.author.avatar_url) ?? entry.author.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover shrink-0" />
            ) : null}
            <span className="truncate">{entry.author?.full_name ?? ''}</span>
          </span>
          {month ? <span>{month}</span> : null}
        </>
      }
      actions={actions}
      className={className}
    />
  )
  return anchorProps ? (
    <a {...anchorProps} className="block h-full">
      {card}
    </a>
  ) : (
    card
  )
}

/** Loading skeleton matching WhatIShippedCard's AdminContentCard shape (3:2 cover
 *  + title / summary / meta lines). Used by the related-content rail while a
 *  group hydrates so there's no shape jump when the real card lands. */
export function WhatIShippedCardSkeleton({ className }: { className?: string }) {
  // Same convention as BlogCardSkeleton et al.: animate-pulse on the container,
  // `bg-ods-bg` placeholder blocks, flex-grow body with an `mt-auto` avatar+name
  // row. Shape mirrors WhatIShippedCard's AdminContentCard (rounded-2xl, 3:2 cover).
  return (
    <div className={`group bg-ods-card border border-ods-border rounded-2xl overflow-hidden h-full flex flex-col animate-pulse ${className ?? ''}`}>
      <div className="aspect-[3/2] bg-ods-bg" />
      <div className="p-4 flex flex-col flex-grow space-y-3">
        <div className="h-5 w-3/4 bg-ods-bg rounded" />
        <div className="h-3 w-full bg-ods-bg/60 rounded" />
        <div className="h-3 w-4/5 bg-ods-bg/60 rounded" />
        <div className="mt-auto flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-ods-bg" />
          <div className="h-3 w-24 bg-ods-bg/60 rounded" />
        </div>
      </div>
    </div>
  )
}

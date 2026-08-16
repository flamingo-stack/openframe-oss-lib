import React from 'react'
import { EmployeeEntryCard, EmployeeEntryCardSkeleton, type EmployeeEntryCardData } from './employee-entry-card'
import { formatEntryMonthUTC } from '../../../utils/format'

/** Minimal row shape the card renders. Both the hub dashboard entry and the
 *  related-content hydrated row satisfy it structurally. */
export interface WhatIShippedCardData extends EmployeeEntryCardData {
  entry_month?: string | null
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

/**
 * THE single "What I Shipped" card — a thin binding over `EmployeeEntryCard`
 * that maps the reporting month to the shared meta date. Used by BOTH the
 * people-hub dashboard (with owner `actions`) and the related-content rail
 * (with `anchorProps` for click-through), so the card is byte-identical
 * everywhere — one engine, one mapping, no drift.
 */
export function WhatIShippedCard({ entry, placeholderUrl, actions, anchorProps, className }: WhatIShippedCardProps) {
  return (
    <EmployeeEntryCard
      entry={entry}
      dateLabel={formatEntryMonthUTC(entry.entry_month, 'short')}
      placeholderUrl={placeholderUrl}
      actions={actions}
      anchorProps={anchorProps}
      className={className}
    />
  )
}

/** Loading skeleton matching WhatIShippedCard's shape. Shared with every other
 *  employee-entry card so the rail's placeholder never diverges from the card. */
export const WhatIShippedCardSkeleton = EmployeeEntryCardSkeleton

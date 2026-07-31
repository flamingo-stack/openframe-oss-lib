'use client'

/**
 * Data-room / OpenFrame-docs inline chat card.
 *
 * PURE PRESENTATION. The card receives a pre-composed `<a>` prop bundle
 * (`anchorProps`) plus a pre-resolved badge label — both decisions
 * (URL composition + cross-app routing) are made in the consumer's
 * runtime layer, not inside this card.
 *
 * Renders `[card://data_room_doc:<id>]` and `[card://markdown:<id>]` markers
 * — both use this card because their viewer surface is structurally
 * identical; only the `baseRoute` differs (`/data-room` vs `/knowledge-base`).
 */

import React from 'react'
import { ExternalLink } from 'lucide-react'
import { StatusBadge } from '../../ui/status-badge'
import {
  COMPACT_CARD_OUTER,
  COMPACT_CARD_OUTER_STATIC,
  COMPACT_CARD_SKELETON_OUTER,
  COMPACT_CARD_TEXT_COL,
  COMPACT_CARD_TITLE,
} from '../utils/compact-card-classes'
import type { DataRoomDocCardItem } from '../types/entities/data-room-doc'

export interface DataRoomDocCardAnchorProps {
  href: string
  target?: '_blank'
  rel?: 'noopener noreferrer'
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
}

export interface DataRoomDocCardProps {
  item: DataRoomDocCardItem
  className?: string
  /** Pre-composed badge label. REQUIRED — the consumer resolves
   *  `sourceRepo` against its `SOURCE_LABELS_BY_TABLE` registry and
   *  passes the result here.
   *
   *  Why required (no default): if the badge silently defaulted to a
   *  literal like "Data room", a card sourced from openframe-docs (or
   *  any other repo) whose `sourceRepo` resolution failed would
   *  display the wrong provenance label — a real security signal,
   *  because "Data Room" implies private/internal documents to
   *  end-users. Forcing the consumer to supply the label means a
   *  bug at the resolution step surfaces as a TypeScript error
   *  ("badgeText required") instead of a falsely-labeled production
   *  card. The hub-side dispatcher already passes
   *  `getSourceLabel(sourceRepo)` with a non-null fallback. */
  badgeText: string
  /** Pre-composed `<a>` prop bundle. When provided, the outer renders
   *  as `<a {...anchorProps}>`; otherwise the card is non-interactive. */
  anchorProps?: DataRoomDocCardAnchorProps
}

export function DataRoomDocCard({ item, className, badgeText, anchorProps }: DataRoomDocCardProps) {
  const body = (
    <>
      <span className={COMPACT_CARD_TEXT_COL}>
        <span className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className={`${COMPACT_CARD_TITLE} shrink min-w-0`}>{item.title}</span>
          <StatusBadge text={badgeText} variant="button" colorScheme="cyan" className="shrink-0" />
        </span>
        {item.path ? (
          <span className="flex min-w-0 items-center gap-1 text-h6 text-ods-text-secondary">
            <span className="shrink-0 text-ods-text-secondary/70">Path:</span>
            <span className="min-w-0 truncate font-mono">{item.path}</span>
          </span>
        ) : null}
        {item.preview ? (
          <span className="flex min-w-0">
            <span className="line-clamp-2 whitespace-pre-wrap break-words text-h6 text-ods-text-secondary">
              {item.preview}
            </span>
          </span>
        ) : null}
      </span>
      {anchorProps?.href ? (
        <span className="flex shrink-0 items-center self-start h-5 text-ods-text-secondary">
          <ExternalLink className="w-3.5 h-3.5" />
        </span>
      ) : null}
    </>
  )
  if (!anchorProps) {
    return (
      <span className={`${COMPACT_CARD_OUTER_STATIC} ${className ?? ''}`} aria-label="No link available">
        {body}
      </span>
    )
  }
  return (
    <a {...anchorProps} className={`${COMPACT_CARD_OUTER} ${className ?? ''}`}>
      {body}
    </a>
  )
}

export function DataRoomDocCardSkeleton({ className }: { className?: string }) {
  return (
    <span className={`${COMPACT_CARD_SKELETON_OUTER} ${className ?? ''}`}>
      <span className={COMPACT_CARD_TEXT_COL}>
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="h-3.5 w-2/3 rounded bg-ods-bg" />
          <span className="h-4 w-16 rounded-full bg-ods-bg/60" />
        </span>
        <span className="h-4 w-1/2 rounded bg-ods-bg/60" />
        <span className="flex flex-col gap-0 min-w-0">
          <span className="h-5 w-5/6 rounded bg-ods-bg/60" />
          <span className="h-5 w-3/4 rounded bg-ods-bg/60" />
        </span>
      </span>
      <span className="flex shrink-0 items-center self-start h-5">
        <span className="h-3.5 w-3.5 rounded bg-ods-bg" />
      </span>
    </span>
  )
}

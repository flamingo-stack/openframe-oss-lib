'use client'

/**
 * Generic compact entity/document card for any chat type that doesn't
 * warrant a bespoke component.
 *
 * PURE PRESENTATION. Receives pre-composed `<a>` props via `anchorProps`
 * and renders the rest from the item shape.
 */

import React from 'react'
import { ExternalLink } from 'lucide-react'
import { StatusBadge } from '../../ui/status-badge'
import {
  COMPACT_CARD_META_ROW,
  COMPACT_CARD_META_ROW_BOX,
  COMPACT_CARD_OUTER,
  COMPACT_CARD_OUTER_STATIC,
  COMPACT_CARD_SKELETON_OUTER,
  COMPACT_CARD_TEXT_COL,
  COMPACT_CARD_TITLE,
  safeHref,
} from '../utils/compact-card-classes'
import { formatDateUTC as formatDate } from '../../../utils/format'

type BadgeScheme = 'success' | 'error' | 'warning' | 'cyan' | 'default'

export interface GenericEntityCardItem {
  id: string
  title: string
  preview?: string | null
  url?: string | null
  subtitle?: string | null
  badge?: { text: string; scheme?: BadgeScheme } | null
  facts?: Array<{ label: string; value: string }> | null
  dateUpdated?: string | number | null
}

export interface GenericEntityCardAnchorProps {
  href: string
  target?: '_blank'
  rel?: 'noopener noreferrer'
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
}

export interface GenericEntityCardProps {
  item: GenericEntityCardItem
  className?: string
  anchorProps?: GenericEntityCardAnchorProps
}

export function GenericEntityCard({ item, className, anchorProps }: GenericEntityCardProps) {
  const href = safeHref(item.url)
  const dateText = formatDate(item.dateUpdated, { fallback: '', timezone: 'local' })
  const body = (
    <>
      <span className={COMPACT_CARD_TEXT_COL}>
        <span className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className={`${COMPACT_CARD_TITLE} shrink min-w-0`}>{item.title}</span>
          {item.badge ? (
            <StatusBadge
              text={item.badge.text}
              variant="button"
              colorScheme={item.badge.scheme || 'default'}
              className="shrink-0"
            />
          ) : null}
        </span>
        {item.subtitle ? (
          <span className="flex min-w-0 items-center gap-1 text-[11px] leading-4 text-ods-text-secondary">
            <span className="min-w-0 truncate font-mono">{item.subtitle}</span>
          </span>
        ) : null}
        {item.preview ? (
          <span className="flex min-w-0">
            <span className="line-clamp-2 whitespace-pre-wrap break-words text-[13px] leading-5 text-ods-text-secondary">
              {item.preview}
            </span>
          </span>
        ) : null}
        {item.facts && item.facts.length > 0 ? (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 min-w-0 text-[11px] leading-4">
            {item.facts.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 min-w-0 truncate">
                <span className="text-ods-text-secondary/70 shrink-0">{f.label}:</span>
                <span className="text-ods-text-primary font-medium truncate">{f.value}</span>
              </span>
            ))}
          </span>
        ) : null}
        {dateText ? (
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className={COMPACT_CARD_META_ROW}>
              <span className="whitespace-nowrap">{dateText}</span>
            </span>
          </span>
        ) : null}
      </span>
      {href ? (
        <span className="flex shrink-0 items-center self-start h-5 text-ods-text-secondary">
          <ExternalLink className="w-3.5 h-3.5" />
        </span>
      ) : null}
    </>
  )
  if (anchorProps) {
    return (
      <a {...anchorProps} className={`${COMPACT_CARD_OUTER} ${className ?? ''}`}>
        {body}
      </a>
    )
  }
  return href ? (
    <a href={href} className={`${COMPACT_CARD_OUTER} ${className ?? ''}`}>
      {body}
    </a>
  ) : (
    <span className={`${COMPACT_CARD_OUTER_STATIC} ${className ?? ''}`} aria-label="No link available">
      {body}
    </span>
  )
}

export function GenericEntityCardSkeleton({ className }: { className?: string }) {
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
        <span className="h-3 w-1/4 rounded bg-ods-bg/70" />
      </span>
      <span className="flex shrink-0 items-center self-start h-5">
        <span className="h-3.5 w-3.5 rounded bg-ods-bg" />
      </span>
    </span>
  )
}

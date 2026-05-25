'use client'

/**
 * HubSpot Ticket Card — unified visual for hubspot-tickets markers.
 *
 * PURE PRESENTATION (no internal nav). The card receives the structured
 * `<a>` prop bundle via `anchorProps` (composed by the caller from a
 * runtime hook) and renders the rest from the `HubspotTicketItem` shape
 * directly.
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
import type { HubspotTicketItem } from '../types/entities/hubspot-ticket'

export interface HubspotTicketCardAnchorProps {
  href: string
  target?: '_blank'
  rel?: 'noopener noreferrer'
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
}

export interface HubspotTicketCardProps {
  item: HubspotTicketItem
  variant?: 'row' | 'compact'
  className?: string
  anchorProps?: HubspotTicketCardAnchorProps
}

function formatToken(token: string | null | undefined): string | null {
  if (!token) return null
  const lower = token.toLowerCase().replace(/_/g, ' ')
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

type BadgeScheme = 'success' | 'error' | 'warning' | 'cyan' | 'default'

function priorityScheme(priority: string | null | undefined): BadgeScheme {
  const p = (priority || '').toUpperCase()
  if (p === 'URGENT') return 'error'
  if (p === 'HIGH') return 'warning'
  if (p === 'MEDIUM') return 'cyan'
  return 'default'
}

function statusScheme(status: string | null | undefined): BadgeScheme {
  const s = (status || '').toUpperCase()
  if (s === 'CLOSED') return 'success'
  if (s === 'OPEN') return 'warning'
  return 'default'
}

export function HubspotTicketCard({ item, variant = 'compact', className, anchorProps }: HubspotTicketCardProps) {
  const statusText = item.statusLabel ?? formatToken(item.status)
  const priorityText = formatToken(item.priority)
  const dateText = formatDate(item.dateUpdated, { fallback: '', timezone: 'local' })

  if (variant === 'row') {
    return (
      <div className={`flex items-center gap-3 min-w-0 ${className ?? ''}`}>
        <span className="text-ods-text-primary text-sm font-medium truncate max-w-[260px] shrink-0">{item.title}</span>
        {item.preview ? (
          <span className="text-ods-text-secondary text-sm flex-1 min-w-0 truncate">{item.preview}</span>
        ) : null}
        {statusText ? (
          <StatusBadge text={statusText} variant="button" colorScheme={statusScheme(item.status)} />
        ) : null}
        {dateText ? (
          <span className="text-ods-text-secondary text-xs w-24 shrink-0 text-right">{dateText}</span>
        ) : null}
      </div>
    )
  }

  const metaParts: React.ReactNode[] = []
  if (item.customerCompany) {
    metaParts.push(
      <span key="company" className="min-w-0 truncate">{item.customerCompany}</span>,
    )
  }
  if (dateText) metaParts.push(<span key="date" className="whitespace-nowrap">{dateText}</span>)

  const href = safeHref(item.url)
  const body = (
    <>
      <span className={COMPACT_CARD_TEXT_COL}>
        <span className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className={`${COMPACT_CARD_TITLE} shrink min-w-0`}>{item.title}</span>
          {priorityText ? (
            <StatusBadge
              text={priorityText}
              variant="button"
              colorScheme={priorityScheme(item.priority)}
              className="shrink-0"
            />
          ) : null}
          {statusText ? (
            <StatusBadge
              text={statusText}
              variant="button"
              colorScheme={statusScheme(item.status)}
              className="shrink-0"
            />
          ) : null}
        </span>
        {item.customerEmail ? (
          <span className="flex min-w-0 items-center gap-1 text-[11px] leading-4 text-ods-text-secondary">
            <span className="shrink-0 text-ods-text-secondary/70">From:</span>
            <span className="min-w-0 truncate">{item.customerEmail}</span>
          </span>
        ) : null}
        <span className="flex min-w-0">
          <span className="line-clamp-4 whitespace-pre-wrap break-words text-[13px] leading-5 text-ods-text-secondary">
            {item.preview || <span className="italic text-ods-text-secondary/60">No description provided.</span>}
          </span>
        </span>
        {metaParts.length > 0 ? (
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className={COMPACT_CARD_META_ROW}>
              {metaParts.map((part, i) => (
                <React.Fragment key={i}>
                  {i > 0 ? <span className="text-ods-text-secondary/40 shrink-0">·</span> : null}
                  <span className="min-w-0 truncate">{part}</span>
                </React.Fragment>
              ))}
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
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${COMPACT_CARD_OUTER} ${className ?? ''}`}
    >
      {body}
    </a>
  ) : (
    <span className={`${COMPACT_CARD_OUTER_STATIC} ${className ?? ''}`} aria-label="No link available">{body}</span>
  )
}

export function HubspotTicketCardSkeleton({ variant = 'compact', className }: { variant?: 'row' | 'compact'; className?: string }) {
  if (variant === 'row') {
    return (
      <div className={`flex items-center gap-3 min-w-0 animate-pulse ${className ?? ''}`}>
        <div className="h-3 w-40 bg-ods-bg rounded shrink-0" />
        <div className="h-3 w-2/3 bg-ods-bg/60 rounded flex-1" />
        <div className="h-3 w-16 bg-ods-bg/60 rounded shrink-0" />
        <div className="h-3 w-20 bg-ods-bg/60 rounded shrink-0" />
      </div>
    )
  }
  return (
    <span className={`${COMPACT_CARD_SKELETON_OUTER} ${className ?? ''}`}>
      <span className={COMPACT_CARD_TEXT_COL}>
        <span className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="h-3.5 w-2/3 rounded bg-ods-bg" />
          <span className="h-4 w-12 rounded-full bg-ods-bg/60" />
          <span className="h-4 w-16 rounded-full bg-ods-bg/60" />
        </span>
        <span className="h-4 w-1/2 rounded bg-ods-bg/60" />
        <span className="flex flex-col gap-0 min-w-0">
          <span className="h-5 w-5/6 rounded bg-ods-bg/60" />
          <span className="h-5 w-4/6 rounded bg-ods-bg/60" />
          <span className="h-5 w-3/4 rounded bg-ods-bg/60" />
          <span className="h-5 w-2/5 rounded bg-ods-bg/60" />
        </span>
        <span className={COMPACT_CARD_META_ROW_BOX}>
          <span className="h-3 w-1/3 rounded bg-ods-bg/70" />
        </span>
      </span>
      <span className="flex shrink-0 items-center self-start h-5">
        <span className="h-3.5 w-3.5 rounded bg-ods-bg" />
      </span>
    </span>
  )
}

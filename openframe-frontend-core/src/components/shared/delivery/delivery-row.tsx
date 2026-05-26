'use client'

/**
 * `<DeliveryRow />` — canonical single-row presentation for a ClickUp
 * delivery item.
 *
 * Single source of truth: both the `/bug-fixes-and-enhancements` page
 * (via `DeliveryTable`) AND the linked-delivery card on a HubSpot ticket
 * (via `TicketLinkedDeliveryCard`) compose this primitive. Visual parity
 * across those two surfaces is the design goal — the user reads the
 * card on their ticket and recognises it as a row from the public
 * delivery list.
 *
 * Behaviors:
 *   - `href` set → outer element is an `<a>`, the whole row becomes
 *     clickable (used by the linked-card surface to deep-link into
 *     `/bug-fixes-and-enhancements?focus=<id>`).
 *   - `id` set → outer element gets that DOM id so the consuming page
 *     can `scrollIntoView` to it when the URL carries `?focus=<id>`.
 *   - `highlighted` true → brief accent border + background pulse
 *     (`animate-flash-focus` keyframe defined in `tailwind.config.ts`).
 *   - `caption` set → small uppercase label rendered above the title
 *     ("LINKED DELIVERY" on the ticket-side variant). Omitted on the
 *     standard list rendering.
 */

import * as React from 'react'
import { StatusBadge } from '../../ui/status-badge'
import { getStatusColorScheme } from '../../../utils'
import {
  type DeliveryItem,
  TASK_TYPE_LABELS,
  TASK_TYPE_TEXT_COLORS,
} from '../../../types/delivery'
import { cn } from '../../../utils/cn'

/** Same heuristic as DeliveryTable's local helper. Inlined so the row
 *  primitive owns its complete rendering contract. */
function getRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  if (months > 0) return months === 1 ? 'last month' : `${months} months ago`
  if (weeks > 0) return weeks === 1 ? 'last week' : `${weeks} weeks ago`
  if (days > 0) return days === 1 ? 'yesterday' : `${days} days ago`
  return 'today'
}

export interface DeliveryRowProps {
  item: DeliveryItem
  /** When set, the row is an `<a href>` — used to deep-link from the
   *  ticket's linked-card to `/bug-fixes-and-enhancements?focus=<id>`. */
  href?: string
  /** DOM id assigned to the outer element. Set on the standard delivery
   *  table so `?focus=<id>` can scroll the page to it. */
  id?: string
  /** When true, applies the `animate-flash-focus` highlight. Driven by
   *  the consuming page after `scrollIntoView`. */
  highlighted?: boolean
  /** Small uppercase caption rendered above the title. Used by the
   *  linked-delivery card variant ("LINKED DELIVERY"). */
  caption?: string
  className?: string
}

export function DeliveryRow({
  item,
  href,
  id,
  highlighted,
  caption,
  className,
}: DeliveryRowProps) {
  const taskType = item.taskType as keyof typeof TASK_TYPE_LABELS
  const typeBadgeLabel = TASK_TYPE_LABELS[taskType] || 'TASK'
  const typeBadgeTextColor = TASK_TYPE_TEXT_COLORS[taskType] || ''
  const statusBadgeScheme = getStatusColorScheme(item.status)
  const relativeTime = getRelativeTime(item.dateUpdated)
  const subtitle = `ACTIVE ${relativeTime}${item.listNames.length > 0 ? `, ${item.listNames.join(', ')}` : ''}, ${item.id}`

  const inner = (
    <div className="flex flex-col md:flex-row items-start justify-between gap-[12px] md:gap-[16px] w-full">
      {/* Left: caption (optional) + title + subtitle + description */}
      <div className="flex-1 min-w-0 w-full md:w-auto flex flex-col gap-[12px] md:gap-[16px]">
        {caption && (
          <p className="text-xs font-medium uppercase tracking-wider text-ods-text-secondary">
            {caption}
          </p>
        )}
        <div className="min-h-[24px] md:min-h-[24px] flex items-center">
          <h3 className="text-h3 text-ods-text-primary tracking-[-0.36px] flex-1 line-clamp-2 md:truncate break-words">
            {item.title}
          </h3>
        </div>
        <div className="min-h-[20px] flex items-center">
          <p className="text-h5 text-ods-text-secondary uppercase tracking-[-0.28px] truncate">
            {subtitle}
          </p>
        </div>
        <div className="min-h-[72px] flex items-center">
          <p className="text-h4 text-ods-text-secondary line-clamp-3 break-words">
            {item.description || 'No description provided'}
          </p>
        </div>
      </div>

      {/* Right: status + task-type badges */}
      <div className="flex-shrink-0 self-start flex flex-col gap-2">
        <StatusBadge
          text={item.status.toUpperCase()}
          colorScheme={statusBadgeScheme}
          variant="card"
          className="border border-ods-border"
        />
        <StatusBadge
          text={typeBadgeLabel}
          variant="card"
          className={`border border-ods-border ${typeBadgeTextColor}`}
        />
      </div>
    </div>
  )

  const baseClass = cn(
    'block p-[12px] md:p-[16px] no-underline text-inherit transition-colors duration-150',
    href && 'hover:bg-ods-bg-hover cursor-pointer',
    highlighted && 'bg-ods-bg-hover ring-2 ring-ods-accent ring-inset',
    className,
  )

  if (href) {
    return (
      <a
        id={id}
        href={href}
        className={baseClass}
        // No `target="_blank"` — internal nav stays in the same tab so
        // the focus param survives + `?focus=<id>` triggers scroll.
      >
        {inner}
      </a>
    )
  }

  return (
    <div id={id} className={baseClass}>
      {inner}
    </div>
  )
}

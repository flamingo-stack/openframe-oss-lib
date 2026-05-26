'use client'

/**
 * `<TicketLinkedDeliveryCard />` — renders the ClickUp delivery task
 * linked to a HubSpot ticket as a single bordered row with:
 *   - Task title (from `clickup_tasks.name`)
 *   - Status badge (color = ClickUp's own status_color; falls back to
 *     `getStatusColorScheme(status)` when the hex is missing)
 *   - Target version label (when set)
 *   - External-link affordance pointing at the ClickUp task URL
 *
 * Reused primitives only — `StatusBadge` for the status pill,
 * `ExternalLinkIcon` for the affordance. The card chrome matches the
 * `ConversationCardRow` border + spacing used elsewhere in the drawer
 * so the surface reads as one continuous list.
 *
 * Rendered conditionally by `<TicketDetailDrawer>` ONLY when the
 * server-side `attachClickupTasks` step populated `ticket.clickup`;
 * customer-only tickets (no linked delivery) skip rendering entirely.
 */

import { StatusBadge } from '../ui/status-badge'
import { ExternalLinkIcon } from '../icons-v2-generated/interface/external-link-icon'
import { getStatusColorScheme } from '../chat/utils/agent-status-message'
import { cn } from '../../utils/cn'
import type { TicketClickupSummary } from './types'

export interface TicketLinkedDeliveryCardProps {
  clickup: TicketClickupSummary
  className?: string
}

export function TicketLinkedDeliveryCard({
  clickup,
  className,
}: TicketLinkedDeliveryCardProps) {
  // Prefer ClickUp's own per-status hex color so the badge matches the
  // board exactly (e.g. "design approved" #e16b16). When missing,
  // fall back to the abstract scheme so the badge still reads correctly.
  const statusText = (clickup.status ?? 'Unknown').replace(/\b\w/g, (c) => c.toUpperCase())
  const colorScheme = getStatusColorScheme(clickup.status ?? '')
  const inlineStyle = clickup.status_color
    ? { backgroundColor: `${clickup.status_color}26`, color: clickup.status_color, borderColor: `${clickup.status_color}66` }
    : undefined

  const Wrapper: 'a' | 'div' = clickup.url ? 'a' : 'div'
  const wrapperProps = clickup.url
    ? {
        href: clickup.url,
        target: '_blank',
        rel: 'noopener noreferrer',
      }
    : {}

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-md border border-ods-border bg-ods-bg',
        clickup.url && 'hover:bg-ods-bg-hover transition-colors duration-150 cursor-pointer',
        'no-underline text-inherit',
        className,
      )}
    >
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wider text-ods-text-secondary">
          Linked delivery
        </p>
        <p
          className="text-h4 text-ods-text-primary truncate"
          title={clickup.name ?? 'ClickUp task'}
        >
          {clickup.name ?? 'ClickUp task'}
        </p>
        {clickup.target_version && (
          <p className="text-h6 text-ods-text-secondary truncate">
            Target version: {clickup.target_version}
          </p>
        )}
      </div>

      <StatusBadge
        text={statusText}
        colorScheme={colorScheme}
        variant="card"
        className="border"
        style={inlineStyle}
      />

      {clickup.url && (
        <ExternalLinkIcon
          className="size-4 text-ods-text-secondary shrink-0"
          aria-label="Open in ClickUp"
        />
      )}
    </Wrapper>
  )
}

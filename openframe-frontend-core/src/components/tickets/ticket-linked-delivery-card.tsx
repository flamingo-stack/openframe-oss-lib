'use client'

/**
 * `<TicketLinkedDeliveryCard />` — renders the ClickUp delivery task
 * linked to a HubSpot ticket as a single `<DeliveryRow />` (the same
 * primitive `/bug-fixes-and-enhancements` uses for its row tiles).
 *
 * Navigation is unified with the chat-inline delivery card: both go
 * through `buildDevSectionUrl('delivery', external_id)`, composed
 * server-side and shipped on `clickup.delivery_href`. The URL carries
 * `?search=<external_id>` so the landing list filters to that exact
 * task (the canonical "deep-link to a specific delivery row" mechanism
 * already in place for chat).
 *
 * Soft-nav happens via the env-aware `next/link` shim that the host
 * registers — back-button restores /tickets with React state intact
 * (no skeleton flash, no TanStack-Query cache loss).
 */

import { DeliveryRow } from '../shared/delivery/delivery-row'
import type { DeliveryItem } from '../../types/delivery'
import type { TicketClickupSummary } from './types'

export interface TicketLinkedDeliveryCardProps {
  clickup: TicketClickupSummary
  className?: string
}

export function TicketLinkedDeliveryCard({
  clickup,
  className,
}: TicketLinkedDeliveryCardProps) {
  const item: DeliveryItem = {
    id: clickup.external_id,
    title: clickup.title ?? 'Linked delivery task',
    description: clickup.description ?? '',
    status: clickup.status ?? 'unknown',
    statusColor: clickup.status_color ?? '#87909e',
    taskType: clickup.task_type ?? 'Request',
    customItemId: clickup.custom_item_id,
    listNames: clickup.list_names,
    dateOpened: clickup.date_opened ?? 0,
    dateUpdated: clickup.date_updated ?? clickup.date_opened ?? Date.now(),
    dateClosed: clickup.date_closed,
    clickupUrl: clickup.clickup_url ?? '',
  }

  return (
    <div
      className={`rounded-md border border-ods-border bg-ods-bg overflow-hidden ${className ?? ''}`}
    >
      <DeliveryRow
        item={item}
        href={clickup.delivery_href}
        caption="Linked delivery"
      />
    </div>
  )
}

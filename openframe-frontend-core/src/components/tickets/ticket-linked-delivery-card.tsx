'use client'

/**
 * `<TicketLinkedDeliveryCard />` — renders the ClickUp delivery task
 * linked to a HubSpot ticket as a single `<DeliveryRow />` (the same
 * primitive `/bug-fixes-and-enhancements` uses for its row tiles).
 *
 * Visual parity is the point: when a customer sees this card on their
 * ticket, it looks exactly like the row they'll land on after clicking
 * — same title placement, same status + task-type badges, same density.
 *
 * Click behavior: navigates to
 * `/bug-fixes-and-enhancements?focus=<external_id>`. `DeliveryLists`
 * reads the `focus` param and smooth-scrolls + briefly highlights the
 * matched row. Customer never leaves OpenFrame for ClickUp.
 *
 * Why a thin wrapper over `<DeliveryRow />`:
 *   - Single source of truth for delivery row presentation.
 *   - Adapts the ticket-side `TicketClickupSummary` to the shared
 *     `DeliveryItem` wire shape exactly once, here.
 *   - Adds the bordered card chrome (`rounded` + `border`) so the row
 *     reads as a standalone tile inside the ticket drawer, while the
 *     standard list view keeps the seamless table look.
 */

import { DeliveryRow } from '../shared/delivery/delivery-row'
import type { DeliveryItem } from '../../types/delivery'
import type { TicketClickupSummary } from './types'

export interface TicketLinkedDeliveryCardProps {
  clickup: TicketClickupSummary
  /** Target URL for the inline navigation. Defaults to
   *  `/bug-fixes-and-enhancements?focus=<external_id>`; embedders can
   *  override (e.g. a third-party app hosting the lib that surfaces its
   *  delivery list at a different route). */
  deliveryHref?: (externalId: string) => string
  className?: string
}

const DEFAULT_DELIVERY_HREF = (externalId: string) =>
  `/bug-fixes-and-enhancements?focus=${encodeURIComponent(externalId)}`

export function TicketLinkedDeliveryCard({
  clickup,
  deliveryHref = DEFAULT_DELIVERY_HREF,
  className,
}: TicketLinkedDeliveryCardProps) {
  // Map the compact ticket-side projection to the canonical
  // `DeliveryItem` shape. Null-safe — every `DeliveryRow` field has a
  // sensible fallback when the underlying clickup_task row is missing
  // data (e.g. a task with no description still renders, just without
  // the description line).
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
        href={deliveryHref(clickup.external_id)}
        caption="Linked delivery"
      />
    </div>
  )
}

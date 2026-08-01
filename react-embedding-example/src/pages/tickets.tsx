import { TicketAlertsButton } from '@flamingo-stack/openframe-frontend-core/components/navigation'
import {
  HelpCenterList,
  TicketLiveProvider,
} from '@flamingo-stack/openframe-frontend-core/components/tickets'

/**
 * HelpCenterList composes the lib's DevSectionPage chrome + create form + ticket
 * list internally, and identifies the (proxy-injected) customer via ChatRuntime.
 * All six ticket endpoints (reads/writes + live stream + unread state) come from
 * `runtime.endpoints` (see content-runtime.ts / EP).
 *
 * `TicketLiveProvider` demonstrates the realtime layer end-to-end:
 *   - SSE subscription to `EP.ticketStream` (fetch-based reader — carries the
 *     embed auth adapter's bearer, which `EventSource` cannot);
 *   - a header-style `TicketAlertsButton` cell whose `bg-ods-warning` dot
 *     lights up when a support reply lands (server-stamped unread predicate);
 *   - live drawer/list updates via stream-driven query invalidation — no
 *     client-side polling anywhere.
 */
export function TicketsPage() {
  return (
    <TicketLiveProvider>
      {/* Minimal header strip demonstrating the unified alerts cell — real
          hosts mount it inside their header shell (hub `HeaderConfig.tickets`,
          console `AppHeader.showTicketAlerts`). */}
      <div className="flex h-14 items-center justify-end border-b border-ods-border">
        <TicketAlertsButton href="/tickets" className="border-l border-ods-border" />
      </div>
      <HelpCenterList />
    </TicketLiveProvider>
  )
}

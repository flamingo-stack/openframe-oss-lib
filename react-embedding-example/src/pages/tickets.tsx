import { HelpCenterList } from '@flamingo-stack/openframe-frontend-core/components/tickets'

/**
 * HelpCenterList composes the lib's DevSectionPage chrome + create form + ticket
 * list internally, and identifies the (proxy-injected) customer via ChatRuntime.
 * All six ticket endpoints (reads/writes + live stream + unread state) come from
 * `runtime.endpoints` (see content-runtime.ts / EP).
 *
 * Realtime is APP-WIDE, not page-local: `TicketLiveProvider` is mounted in
 * app-providers.tsx, and the unread indication renders in the SHARED lib
 * header (`HeaderConfig.tickets` → TicketAlertsButton in app-shell.tsx) —
 * count pill when replies are unread, deep-link to the newest-unread ticket,
 * live drawer/list updates via stream-driven invalidation. This page is just
 * the destination surface.
 */
export function TicketsPage() {
  return <HelpCenterList />
}

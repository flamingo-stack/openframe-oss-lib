import { HelpCenterList } from '@flamingo-stack/openframe-frontend-core/components/tickets'

/**
 * HelpCenterList composes the lib's DevSectionPage chrome + create form + ticket
 * list internally, and identifies the (proxy-injected) customer via ChatRuntime.
 * Its hooks currently call bare `/api/chat/agent/*`, covered by the dev-only proxy
 * fallback in vite.config.ts until the optional lib `agentBaseUrl` seam lands.
 */
export function TicketsPage() {
  return <HelpCenterList />
}

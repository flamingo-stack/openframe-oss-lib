import { useMemo } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnnouncementBar } from '@flamingo-stack/openframe-frontend-core/components'
import {
  Header,
  type HeaderConfig,
} from '@flamingo-stack/openframe-frontend-core/components/navigation'
import { AskAi } from './ask-ai'
import { WalkthroughVideo } from './walkthrough-video'
import { DOCS_BASE_ROUTE } from '../config/content'

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/onboarding-guides', label: 'Onboarding' },
  { to: DOCS_BASE_ROUTE, label: 'Knowledge Hub' },
  { to: '/roadmap', label: 'Roadmap' },
  { to: '/delivery', label: 'Delivery' },
  { to: '/releases', label: 'Releases' },
  { to: '/authors', label: 'Authors' },
  { to: '/faqs', label: 'FAQ' },
  { to: '/legal/privacy', label: 'Legal' },
  { to: '/contact', label: 'Contact' },
  { to: '/tickets', label: 'Tickets' },
] as const

export function AppShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  // The SHARED lib header — the same `Header` shell every hub platform
  // mounts, proving it embeds cleanly too. Nav links soft-navigate because
  // react-router is registered into the lib's embed-shims Link (see
  // providers/embed-router-bridge); no per-item onClick wiring needed.
  const headerConfig = useMemo<HeaderConfig>(
    () => ({
      logo: {
        element: <span className="font-semibold text-ods-text-primary">OpenFrame embed</span>,
        href: '/',
      },
      navigation: {
        items: NAV.map((n) => ({
          id: n.to,
          label: n.label,
          href: n.to,
          isActive:
            'end' in n && n.end ? pathname === n.to : pathname.startsWith(n.to),
        })),
        position: 'center',
      },
      // Support-ticket alerts cell — attention-only (appears with unread
      // replies, count pill, deep-links to the newest-unread ticket).
      // Fed by the app-wide <TicketLiveProvider> in app-providers.tsx.
      tickets: {
        href: '/tickets',
        onClick: (href) => navigate(href),
      },
      // Mingo launcher in the header — THE chat entry (dispatches
      // `ask-ai:open`; the always-mounted panel in <AskAi /> listens).
      // Same retired-floating-dock model as the hub. No mobile burger:
      // the demo's nav collapses into the shell's center zone; real
      // hosts opt into `mobile.enabled` with their own icons.
      mingo: { enabled: true },
    }),
    [pathname, navigate],
  )

  return (
    <div className="min-h-full bg-ods-bg text-ods-text-primary">
      {/* Client-only mode (no SSR), mounted PROP-LESS: reads its endpoint from
          EndpointsRuntime.announcementsUrl (/content/api/announcements/active).
          The /content proxy forwards the request to the hub, which resolves
          ITS OWN platform via currentPlatform() and returns the announcement
          object verbatim — no URL or platform knob exists on the client.
          Fetches once on mount (animated entrance, no layout snap), refetches
          only on tab refocus when data is >60s old; dismissal persists in a
          cookie on THIS embed's domain. SSR hosts use the other mode: resolve
          server-side and pass `initialAnnouncement`. */}
      <AnnouncementBar />
      <Header config={headerConfig} />
      {/* No container constraint here — each route's lib component manages its
       *  own width (e.g. <DocsHubPage> uses `max-w-[1920px]`, <HelpCenterList>
       *  uses <DevSectionPage>). Wrapping in `max-w-6xl` clipped the docs
       *  surface horizontally and forced its sticky-nav rail off-screen. */}
      <main className="w-full">
        <Outlet />
      </main>
      {/* Always-mounted chat panel (headless — opened by the header's
          Mingo launcher via the ask-ai:open event; no floating trigger). */}
      <AskAi />
      {/* Floating walkthrough-video widget (bottom-left), fetched via /content. */}
      <WalkthroughVideo />
    </div>
  )
}

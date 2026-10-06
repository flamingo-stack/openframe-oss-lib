import { useMemo } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnnouncementBar } from '@flamingo-stack/openframe-frontend-core/components'
import {
  SiteHeader,
  TicketAlertsButton,
  type SiteNav,
} from '@flamingo-stack/openframe-frontend-core/components/navigation'
import { AskAi } from './ask-ai'
import { WalkthroughVideo } from './walkthrough-video'
import { DOCS_BASE_ROUTE } from '../config/content'

const NAV = [
  // No "Home" item — the header wordmark links home.
  { to: '/onboarding-guides', label: 'Onboarding' },
  { to: DOCS_BASE_ROUTE, label: 'Knowledge Hub' },
  { to: '/roadmap', label: 'Roadmap' },
  { to: '/delivery', label: 'Delivery' },
  { to: '/releases', label: 'Releases' },
  { to: '/authors', label: 'Authors' },
  { to: '/faqs', label: 'FAQ' },
  { to: '/trust-center', label: 'Trust' },
  { to: '/legal/privacy', label: 'Legal' },
  { to: '/contact', label: 'Contact' },
  { to: '/schedule-a-call', label: 'Schedule' },
  { to: '/tickets', label: 'Tickets' },
  { to: '/mcp', label: 'MCP' },
] as const

// The site navigation model: plain data, the same shape every hub platform
// hands the shared `SiteHeader`. Each entry is a plain link (no panels), and
// `match` marks the current section.
const SITE_NAV: SiteNav = {
  menus: NAV.map((n) => ({
    id: n.to,
    label: n.label,
    href: n.to,
    match: [n.to],
  })),
  footerColumns: [],
  primaryCta: 'none',
  legal: { company: 'OpenFrame', notes: [], links: [] },
  brand: { name: 'OpenFrame', tagline: '', social: [] },
}

export function AppShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  // The SHARED lib header, the same `SiteHeader` every hub platform mounts,
  // proving it embeds cleanly too. Its links soft-navigate because
  // react-router is registered into the lib's embed-shims Link (see
  // providers/embed-router-bridge); no `renderLink` needed.
  const sideActions = useMemo(
    () => (
      // Support-ticket alerts cell: attention-only (appears with unread
      // replies, count pill, deep-links to the newest-unread ticket). Fed by
      // the app-wide <TicketLiveProvider> in app-providers.tsx.
      <TicketAlertsButton
        href="/tickets"
        onNavigate={(href) => navigate(href)}
        className="border-l border-ods-border"
      />
    ),
    [navigate],
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
      <SiteHeader
        nav={SITE_NAV}
        pathname={pathname}
        logo={<span className="font-semibold text-ods-text-primary">OpenFrame</span>}
        logoHref="/"
        // Mingo launcher in the header: THE chat entry (dispatches
        // `ask-ai:open`; the always-mounted panel in <AskAi /> listens).
        mingo={{}}
        sideActions={sideActions}
      />
      {/* No container constraint here — each route's lib component manages its
       *  own width (e.g. <DocsHubPage> uses `max-w-[1920px]`, <HelpCenterList>
       *  uses <DevSectionPage>). Wrapping in `max-w-6xl` clipped the docs
       *  surface horizontally and forced its sticky-nav rail off-screen. */}
      <main className="w-full">
        <Outlet />
      </main>
      {/* Always-mounted chat panel (headless: opened by the header's
          Mingo launcher via the ask-ai:open event; no floating trigger). */}
      <AskAi />
      {/* Floating walkthrough-video widget (bottom-left), fetched via /content. */}
      <WalkthroughVideo />
    </div>
  )
}

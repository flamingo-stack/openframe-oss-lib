import { useMemo } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnnouncementBar, useLegalDocuments } from '@flamingo-stack/openframe-frontend-core/components'
import {
  SiteHeader,
  TicketAlertsButton,
  type SiteNav,
} from '@flamingo-stack/openframe-frontend-core/components/navigation'
import { AskAi } from './ask-ai'
import { useAssistantIdentity } from '../providers/assistant-identity'
import { WalkthroughVideo } from './walkthrough-video'
import { DOCS_BASE_ROUTE } from '../config/content'
import { EP } from '../config/endpoints'

type NavEntry = { to: string; label: string }

// No "Home" item: the header wordmark links home. The pages are grouped into a
// few menus, as on every hub platform: one top-level item per page did not fit
// the bar and ran under the assistant launcher.
const NAV: ReadonlyArray<{ id: string; label: string; links: ReadonlyArray<NavEntry> }> = [
  {
    id: 'learn',
    label: 'Learn',
    links: [
      { to: '/onboarding-guides', label: 'Onboarding' },
      { to: DOCS_BASE_ROUTE, label: 'Knowledge Hub' },
      { to: '/faqs', label: 'FAQ' },
      { to: '/authors', label: 'Authors' },
    ],
  },
  {
    id: 'product',
    label: 'Product',
    links: [
      { to: '/roadmap', label: 'Roadmap' },
      { to: '/bug-fixes-and-enhancements', label: 'Delivery' },
      { to: '/releases', label: 'Releases' },
      { to: '/download', label: 'Download' },
      { to: '/trust-center', label: 'Trust' },
    ],
  },
  {
    id: 'support',
    label: 'Support',
    links: [
      { to: '/tickets', label: 'Tickets' },
      { to: '/contact', label: 'Contact' },
      { to: '/schedule-a-call', label: 'Schedule' },
      { to: '/mcp', label: 'MCP' },
    ],
  },
]

const menuOf = (id: string, label: string, links: ReadonlyArray<NavEntry>) => ({
  id,
  label,
  match: links.map((l) => l.to),
  columns: [{ id, links: links.map((l) => ({ id: l.to, label: l.label, href: l.to })) }],
})

// The site navigation model: plain data, the same shape every hub platform
// hands the shared `SiteHeader`. Each menu is one dropdown list, and `match`
// marks the current section. The legal documents are the last menu, one link
// each, from the hub's list: the host names none of them.
function siteNav(legal: ReadonlyArray<{ docType: string; title: string }>): SiteNav {
  const legalLinks = legal.map((doc) => ({ to: `/legal/${doc.docType}`, label: doc.title }))
  return {
    menus: [
      ...NAV.map((m) => menuOf(m.id, m.label, m.links)),
      ...(legalLinks.length > 0 ? [menuOf('legal', 'Legal', legalLinks)] : []),
    ],
    footerColumns: [],
    primaryCta: 'none',
    legal: { company: 'OpenFrame', notes: [], links: [] },
    brand: { name: 'OpenFrame', tagline: '', social: [] },
  }
}

export function AppShell() {
  const { pathname } = useLocation()
  // The launcher shows the SERVER's identity (name and glyph), the same one the
  // FAQ's ask card uses; with none configured, the lib's own defaults.
  const assistant = useAssistantIdentity()
  const { documents: legalDocuments } = useLegalDocuments({ apiEndpoint: EP.legalDocuments })
  const nav = useMemo(() => siteNav(legalDocuments), [legalDocuments])
  const mingo = useMemo(
    () => ({ label: assistant.name ?? undefined, icon: assistant.icon }),
    [assistant.name, assistant.icon],
  )

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
        className="border-l border-ods-border"
      />
    ),
    [],
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
        nav={nav}
        pathname={pathname}
        logo={<span className="font-semibold text-ods-text-primary">OpenFrame</span>}
        logoHref="/"
        // Mingo launcher in the header: THE chat entry (dispatches
        // `ask-ai:open`; the always-mounted panel in <AskAi /> listens).
        mingo={mingo}
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

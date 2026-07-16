import { NavLink, Outlet } from 'react-router-dom'
import { AnnouncementBar } from '@flamingo-stack/openframe-frontend-core/components'
import { AskAi } from './ask-ai'
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
  // No router bridge / nav wiring here. react-router is registered into the lib's
  // embed-shims once (see providers/embed-router-bridge), so every lib surface this
  // app mounts — chat source chips / markdown anchors / entity-card dispatch,
  // onboarding cards, the releases list — soft-navigates through that registered
  // router directly. No runtime.navigation callback, no document-click interceptor.
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
      <header className="sticky top-0 z-40 border-b border-ods-border bg-ods-card/95 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-1 px-4 py-3">
          <span className="mr-3 font-semibold">OpenFrame embed</span>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={'end' in n ? n.end : undefined}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm ${
                  isActive
                    ? 'bg-ods-bg text-ods-text-primary'
                    : 'text-ods-text-secondary hover:text-ods-text-primary'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      {/* No container constraint here — each route's lib component manages its
       *  own width (e.g. <DocsHubPage> uses `max-w-[1920px]`, <HelpCenterList>
       *  uses <DevSectionPage>). Wrapping in `max-w-6xl` clipped the docs
       *  surface horizontally and forced its sticky-nav rail off-screen. */}
      <main className="w-full">
        <Outlet />
      </main>
      {/* Floating Ask-AI trigger, available on every route. */}
      <AskAi />
    </div>
  )
}

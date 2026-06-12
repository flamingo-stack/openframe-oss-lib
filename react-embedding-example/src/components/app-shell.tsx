import { NavLink, Outlet } from 'react-router-dom'
import { AnnouncementBar } from '@flamingo-stack/openframe-frontend-core/components'
import { AskAi } from './ask-ai'

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/onboarding-guides', label: 'Onboarding' },
  { to: '/roadmap', label: 'Roadmap' },
  { to: '/delivery', label: 'Delivery' },
  { to: '/releases', label: 'Releases' },
  { to: '/authors', label: 'Authors' },
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
      {/* No props — reads its endpoint from EndpointsRuntime.announcementsUrl. */}
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
      <main className="mx-auto max-w-6xl">
        <Outlet />
      </main>
      {/* Floating Ask-AI trigger, available on every route. */}
      <AskAi />
    </div>
  )
}

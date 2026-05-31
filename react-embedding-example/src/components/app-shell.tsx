import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { AnnouncementBar } from '@flamingo-stack/openframe-frontend-core/components'
import { AskAi } from './ask-ai'
import { setInAppNavigate } from '../providers/router-nav'

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/onboarding-guides', label: 'Onboarding' },
  { to: '/roadmap', label: 'Roadmap' },
  { to: '/delivery', label: 'Delivery' },
  { to: '/releases', label: 'Releases' },
  { to: '/legal/privacy', label: 'Legal' },
  { to: '/contact', label: 'Contact' },
  { to: '/tickets', label: 'Tickets' },
] as const

export function AppShell() {
  const navigate = useNavigate()
  // Feeds the ChatRuntime's host-mode navigate() — used by the chat's source chips / markdown
  // anchors / entity-card dispatch AND the lifted ProductReleasesView rows, which all call
  // runtime.navigation.navigate() directly.
  useEffect(() => setInAppNavigate((to) => navigate(to)), [navigate])

  // (The former document-level click interceptor for lib surfaces that rendered a PLAIN
  // `<a href="/…">` is gone: onboarding cards now use the embed-shim `Link` (→ react-router
  // via embed-router-bridge) and the releases list routes via runtime.navigation. Every lib
  // surface this app mounts is now either on the embed-shim `Link` or routes through the
  // runtime seam — no global anchor hack needed.)
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

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
  // anchors / entity-card dispatch, which call runtime.navigation.navigate() directly.
  useEffect(() => setInAppNavigate((to) => navigate(to)), [navigate])

  // Normalized in-app routing for lib surfaces that render a PLAIN `<a href="/…">` (e.g. the
  // onboarding catalog cards, which don't go through runtime.navigation). Mirrors the click
  // rules the chat's source chips apply internally (primary button, no modifiers, same-origin,
  // not new-tab) and routes via react-router instead of a full page reload.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as HTMLElement | null)?.closest?.('a')
      if (!anchor) return
      const target = anchor.getAttribute('target')
      if (target && target !== '_self') return // new-tab / external → let the browser handle it
      const href = anchor.getAttribute('href')
      if (!href || !href.startsWith('/')) return // only same-origin internal paths
      e.preventDefault()
      navigate(href)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [navigate])
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

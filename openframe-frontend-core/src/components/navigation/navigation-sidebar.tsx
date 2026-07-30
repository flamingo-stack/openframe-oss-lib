"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../hooks/ui/use-local-storage'
import { useLgUp, useMdUp } from '../../hooks/ui/use-media-query'
import { NavigationSidebarConfig, NavigationSidebarItem } from '../../types/navigation'
import { cn } from '../../utils'
import { NavigationSidebarHeader } from './navigation-sidebar-header'
import { NavigationSidebarItemButton, NavigationSidebarItemSkeleton } from './navigation-sidebar-item'
import { NavigationSidebarToggle } from './navigation-sidebar-toggle'

const MINIMIZED_WIDTH = 56 // 3.5rem = 56px
const EXPANDED_WIDTH = 224 // 14rem = 224px
const STORAGE_KEY = 'of.navigationSidebar.minimized'

/**
 * The desktop width, as a custom property on `:root`. Read by the `lg:` rule in
 * {@link SIDEBAR_GEOMETRY_CLASSES} and written by this component whenever the
 * user toggles — but NEVER during render.
 *
 * It has to be a global variable rather than an inline style because of WHEN the
 * value is knowable. The width follows a preference in `localStorage`, which the
 * server cannot read: any markup derived from it differs between the server's
 * HTML and the client's hydration render, and React tears the tree down and
 * regenerates it. Seeding this property from a tiny script in `<head>` moves the
 * preference OUT of React's rendered output — the markup becomes identical on
 * both sides, while the width is already correct on the very first paint.
 *
 * Consumers are expected to seed it before first paint; unseeded, the fallback
 * in the class below paints the expanded width until this component's effect
 * catches up, which is the flash the seed exists to remove.
 */
export const NAVIGATION_SIDEBAR_WIDTH_VAR = '--of-navigation-sidebar-width'

/**
 * The same preference as a number — `1` minimized, `0` expanded — for the parts
 * of the sidebar that change SHAPE rather than width, currently the collapse
 * chevron's direction (`.of-navigation-sidebar-chevron` in `app-globals.css`
 * multiplies it by 180deg).
 *
 * A second property rather than something derived from the width, because CSS
 * cannot branch on a length. Seeded and written exactly like the width, and for
 * exactly the same reason: a chevron pointing the wrong way for one frame is the
 * last thing left that gives away that the sidebar was rendered before its own
 * state was knowable.
 */
export const NAVIGATION_SIDEBAR_MINIMIZED_VAR = '--of-navigation-sidebar-minimized'

/**
 * Where the sidebar sits and how wide it is, per breakpoint — as literal classes,
 * because this cannot be decided in JavaScript in time.
 *
 * `useMdUp`/`useLgUp` answer `undefined` until an effect has run, so `isTablet`
 * is false on the first render — the SERVER's render included. A tablet
 * therefore received the desktop branch in its HTML (`relative`, `width:224px`,
 * an inline style no class could outrank) and only snapped to the 56px rail once
 * hydration and an effect had both completed. That is the wide sidebar that
 * flashed on every load, and no amount of JS could fix it: the server has no
 * viewport to consult, so the answer has to be deferred to the one consumer that
 * always knows — the browser's own media evaluation.
 *
 * The state that a viewport CANNOT determine still lives outside the render: the
 * persisted desktop preference reaches the `lg:` rule through
 * {@link NAVIGATION_SIDEBAR_WIDTH_VAR}, and an overlay the user has opened on
 * tablet overrides the rail below with `!important` (an inline width would be
 * simpler, but it would also override the tablet rail on the very first paint,
 * which is the bug being fixed).
 *
 * Widths are `w-14`/`w-56` — the class equivalents of `MINIMIZED_WIDTH` and
 * `EXPANDED_WIDTH`. Keep the two in step; a class string cannot interpolate them.
 */
const SIDEBAR_GEOMETRY_CLASSES = [
  // Tablet: float over the content, anchored to the layout row (`absolute`
  // within AppLayout's `relative` row) — NOT the viewport — so an optional
  // `topBar` above the row is not overlapped. With no topBar the row spans the
  // full viewport, so this is visually identical to a viewport-fixed sidebar.
  // Always minimized here: the rail is the tablet design.
  'md:absolute md:inset-y-0 md:left-0 md:z-[45] md:w-14',
  // Desktop: back in the flex flow, width from the persisted preference. A bare
  // custom-property reference with no var() fallback: the default lives in
  // `:root` in `app-globals.css`, where it is also readable by anything else
  // that needs to reason about the rail.
  'lg:relative lg:inset-auto lg:z-auto lg:h-full lg:w-[var(--of-navigation-sidebar-width)]',
].join(' ')

/** A click the browser will resolve itself — new tab, new window, middle button. */
const isModifiedClick = (event?: React.MouseEvent): boolean =>
  !!event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)

export interface NavigationSidebarProps {
  config: NavigationSidebarConfig
  /**
   * When true, all navigation items are disabled and visually dimmed.
   * The collapse/expand toggle button remains interactive.
   */
  disabled?: boolean
}

export function NavigationSidebar({ config, disabled = false }: NavigationSidebarProps) {
  const isMdUp = useMdUp() ?? false
  const isLgUp = useLgUp() ?? false

  // Tablet = md viewport but not lg. On tablet the sidebar floats over the
  // content area (overlay) instead of pushing it like on desktop.
  const isTablet = isMdUp && !isLgUp

  // Desktop preference persists across sessions. Tablet state is in-memory
  // only so entering tablet always starts minimized without clobbering the
  // user's desktop choice.
  const [desktopMinimized, setDesktopMinimized] = useLocalStorage<boolean>(
    STORAGE_KEY,
    config.minimized ?? false,
  )
  const [tabletMinimized, setTabletMinimized] = useState(true)

  useEffect(() => {
    if (isTablet) setTabletMinimized(true)
  }, [isTablet])

  // `useLocalStorage` reads the store SYNCHRONOUSLY in its initializer, so on the
  // hydration render it already knows a preference the server could not. Anything
  // derived from it — labels, `aria-hidden`, the chevron, the placeholder rows —
  // then differs from the server's HTML, and React throws out the whole tree and
  // regenerates it. So until hydration is done, this renders the server's answer
  // and nothing else.
  //
  // That costs nothing visually. The width is already correct at that point (it
  // comes from the seeded CSS var, not from here), and at the minimized width
  // every label is a `flex-1` in a rail with no room to give — zero-wide whatever
  // this says. What flips on the next commit is opacity and margin on boxes that
  // were never visible.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  const minimized = hydrated ? (isTablet ? tabletMinimized : desktopMinimized) : (config.minimized ?? false)

  // Enable transitions only after the correct width is painted
  const [transitionsEnabled, setTransitionsEnabled] = useState(false)

  const isOverlayOpen = isTablet && !minimized

  const showLabel = !minimized

  const handleToggle = useCallback(() => {
    if (isTablet) {
      setTabletMinimized(prev => !prev)
    } else {
      setDesktopMinimized(prev => !prev)
    }
    config.onToggleMinimized?.()
  }, [isTablet, setDesktopMinimized, config])

  const closeOverlay = useCallback(() => {
    setTabletMinimized(true)
  }, [])

  // Dismiss the tablet overlay with Escape so it behaves like a transient panel
  useEffect(() => {
    if (!isOverlayOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeOverlay()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOverlayOpen, closeOverlay])

  // The entry the user just clicked, held until the route commits.
  //
  // PENDING IS NOT ACTIVE, and keeping the two apart is the whole point. Active
  // means "this is the page you are on" — it carries the accent bar and
  // `aria-current="page"`, and it stays derived from the pathname, so it is
  // never asserted before it is true. Pending only means "this is the one you
  // clicked": a click deserves an answer, but the answer must not be a claim
  // about where you are. Folding pending into active would light the accent on
  // a section still loading and announce it as the current page to a screen
  // reader — a statement that is simply false until the router says otherwise.
  const [pendingItemId, setPendingItemId] = useState<string | null>(null)
  const committedActiveId = useMemo(
    () => config.items.find(item => item.isActive)?.id ?? null,
    [config.items],
  )

  // Any committed change clears it — including one that landed somewhere else
  // entirely (a redirect, a link elsewhere on the page). A navigation that never
  // commits leaves a faint hold on the row it started from; because pending is
  // only ever a soft hint, that costs nothing but a stale hover-weight tint,
  // where a stale ACTIVE state would have been a lie about the current page.
  useEffect(() => {
    setPendingItemId(null)
  }, [committedActiveId])

  const handleItemClick = useCallback((item: NavigationSidebarItem, event?: React.MouseEvent) => {
    event?.stopPropagation()

    if (item.onClick) {
      item.onClick()
      if (isTablet) setTabletMinimized(true)
      return
    }

    if (!item.path) return

    // ⌘/Ctrl/Shift-click and middle-click open the link somewhere else. THIS
    // window is not going anywhere, so the browser is left to it: no
    // preventDefault, no optimistic highlight, no closing the tablet overlay.
    // Entries render as real anchors precisely so those gestures work at all.
    if (isModifiedClick(event)) return

    // A plain click stays the host's to perform, through `onNavigate` exactly
    // as before — the anchor is here for the href (Next prefetches links in the
    // viewport) and for the browser affordances, not to take over routing.
    //
    // `onNavigate` is optional, though, and with no host router there is nothing
    // to hand the click to: swallowing it would leave a real anchor, with a real
    // href, that does nothing at all. So the guard is on having somewhere to
    // send it — otherwise the anchor navigates on its own and we only close the
    // overlay behind it.
    if (config.onNavigate) {
      event?.preventDefault()
      // Re-clicking the page you are already on starts no navigation, so there
      // is nothing to mark — and nothing would ever clear it, since the
      // committed active id is not about to change.
      if (item.id !== committedActiveId) setPendingItemId(item.id)
      config.onNavigate(item.path)
    }

    if (isTablet) setTabletMinimized(true)
  }, [config, isTablet, committedActiveId])

  const { primaryItems, secondaryItems } = useMemo(() => ({
    primaryItems: config.items.filter(item => item.section !== 'secondary'),
    secondaryItems: config.items.filter(item => item.section === 'secondary'),
  }), [config.items])

  // Placeholder rows while the host cannot know its entries yet — see
  // `NavigationSidebarConfig.loading`. Only the ROWS are stood in for: the header,
  // the collapse toggle, the widths and the tablet overlay all behave exactly as
  // when loaded, so this is the loaded rail with unknown contents rather than a
  // separate skeleton sidebar to keep in sync.
  const loadingRows = useMemo(() => {
    if (!config.loading) return null
    const primary = config.loadingRows?.primary ?? 7
    const secondary = config.loadingRows?.secondary ?? 2
    return {
      primary: Array.from({ length: Math.max(0, primary) }, (_, i) => `primary-${i}`),
      secondary: Array.from({ length: Math.max(0, secondary) }, (_, i) => `secondary-${i}`),
    }
  }, [config.loading, config.loadingRows?.primary, config.loadingRows?.secondary])

  const sidebarWidth = useMemo(
    () => (minimized ? `${MINIMIZED_WIDTH}px` : `${EXPANDED_WIDTH}px`),
    [minimized],
  )

  // Published to CSS from an EFFECT, never from render. Before hydration the
  // width belongs to whatever seeded `NAVIGATION_SIDEBAR_WIDTH_VAR` in `<head>`
  // — put it in the markup instead and it becomes part of what React hydrates,
  // which is precisely what cannot agree across the server boundary. Afterwards
  // this is what a toggle moves.
  useLayoutEffect(() => {
    const root = document.documentElement.style
    root.setProperty(NAVIGATION_SIDEBAR_WIDTH_VAR, sidebarWidth)
    root.setProperty(NAVIGATION_SIDEBAR_MINIMIZED_VAR, minimized ? '1' : '0')
  }, [sidebarWidth, minimized])

  // There used to be an `isHydrated` gate here — `isMdUp !== undefined && ...`
  // — meant to hold the sidebar's contents back until the media queries
  // resolved. It could never be false: the `?? false` above had already
  // swallowed the `undefined` it tested for. Removed rather than repaired,
  // because repairing it would be the regression: the contents are server-
  // rendered today, and gating them behind a client-only media query would
  // trade a first paint of the real navigation for an empty rail.
  useLayoutEffect(() => {
    if (!transitionsEnabled) {
      const id = requestAnimationFrame(() => {
        setTransitionsEnabled(true)
      })
      return () => cancelAnimationFrame(id)
    }
  }, [transitionsEnabled])

  return (
    <>
      {/* Backdrop scrim — only visible on tablet while the overlay is open */}
      <div
        className={cn(
          "fixed inset-0 z-[40] bg-ods-overlay",
          "hidden md:block lg:hidden",
          "transition-opacity duration-300",
          isOverlayOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={closeOverlay}
        aria-hidden="true"
      />

      {/* Flex-flow placeholder — reserves the collapsed 56px slot on tablet so
          the main content keeps its position while the sidebar floats above it.
          Rendered unconditionally and scoped by classes for the same reason the
          geometry is: gated on `isTablet`, it was missing from the server HTML
          and from the first client paint — exactly when the sidebar it
          compensates for has already gone `absolute`. */}
      <div className="h-full hidden md:block lg:hidden w-14 flex-shrink-0" aria-hidden="true" />

      <aside
        className={cn(
          "flex-col hidden md:flex flex-shrink-0",
          "bg-ods-card border-r border-ods-border",
          SIDEBAR_GEOMETRY_CLASSES,
          // The one width a viewport cannot imply: an overlay the user opened on
          // tablet. `!important` because it has to beat the `md:w-14` rail, and
          // Tailwind emits `max-lg` BEFORE `md` — source order would hand the
          // tablet back to the rail. Only ever true after a click, so it cannot
          // affect the first paint.
          isOverlayOpen && "max-lg:!w-56",
          transitionsEnabled && "transition-[width] duration-300",
          config.className,
        )}
        aria-label="Main navigation sidebar"
      >
        <NavigationSidebarHeader minimized={minimized} />

        <div className="flex-1 flex flex-col justify-between py-4 overflow-y-auto">
          {/* `aria-busy` on the nav, not the rows: the region is what is loading,
              and each placeholder row is already `aria-hidden`. */}
          <nav className="flex flex-col" aria-label="Primary navigation" aria-busy={!!loadingRows}>
            {loadingRows
              ? loadingRows.primary.map(key => (
                  <NavigationSidebarItemSkeleton key={key} showLabel={showLabel} />
                ))
              : primaryItems.map(item => (
                  <NavigationSidebarItemButton
                    key={item.id}
                    item={item}
                    isActive={item.id === committedActiveId}
                    isPending={item.id === pendingItemId}
                    showLabel={showLabel}
                    disabled={disabled}
                    onClick={handleItemClick}
                  />
                ))}
          </nav>

          {(loadingRows ? loadingRows.secondary.length > 0 : secondaryItems.length > 0) && (
            <nav className="flex flex-col" aria-label="Secondary navigation" aria-busy={!!loadingRows}>
              {loadingRows
                ? loadingRows.secondary.map(key => (
                    <NavigationSidebarItemSkeleton key={key} showLabel={showLabel} />
                  ))
                : secondaryItems.map(item => (
                    <NavigationSidebarItemButton
                      key={item.id}
                      item={item}
                      isActive={item.id === committedActiveId}
                      isPending={item.id === pendingItemId}
                      showLabel={showLabel}
                      disabled={disabled}
                      onClick={handleItemClick}
                    />
                  ))}
            </nav>
          )}
        </div>

        <NavigationSidebarToggle
          minimized={minimized}
          showLabel={showLabel}
          onToggle={handleToggle}
        />
      </aside>
    </>
  )
}

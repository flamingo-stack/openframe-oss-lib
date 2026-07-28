'use client'

import React, { useState, useEffect, useLayoutEffect, useDeferredValue, useMemo, useRef, useCallback, memo, startTransition } from 'react'
import { useSearchParams, useRouter, usePathname } from '../../embed-shims/next-navigation'
import { cn } from '../../utils/cn'

export interface TabItem {
  id: string
  label: string
  /** Optional — text-only tabs (e.g. the homepage content-strip switcher) omit it. */
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
  component?: React.ComponentType<any>
  indicator?: 'success' | 'warning' | 'error'
}

export interface TabNavigationUrlSyncOptions {
  paramName?: string       // Default: 'tab'
  replaceState?: boolean   // Default: true (use replace instead of push)
}

interface TabNavigationProps {
  // Legacy controlled mode (when urlSync is disabled)
  activeTab?: string
  onTabChange?: (tabId: string) => void

  tabs: TabItem[]
  className?: string
  shadowClassName?: string // Tailwind class for shadow gradient color, e.g. "from-black" or "from-red-500"
  /** Force the right-edge gradient to always render, independent of scroll state. */
  showRightGradient?: boolean
  /** Force the left-edge gradient to always render, independent of scroll state. */
  showLeftGradient?: boolean
  /** Tabs grow to share the bar's full width equally (Figma segmented-underline
   *  look, e.g. the 480px homepage strip switcher). Default: natural width. */
  stretchTabs?: boolean

  // URL sync mode
  urlSync?: boolean | TabNavigationUrlSyncOptions
  defaultTab?: string  // Fallback when no valid tab in URL or initial value

  /**
   * Render prop for the tab BODY. Receives the tab to render and, additively,
   * a `isStale` flag — true while the bar has already moved to a newly clicked
   * tab but the body is still showing the PREVIOUS one (see `deferredActiveTab`
   * below). Use it to dim the body or show a pending hint; without it a slow
   * tab looks like a tab that simply did nothing.
   */
  children?: (activeTab: string, state: { isStale: boolean }) => React.ReactNode
}

/** Where the underline sits, in the strip's own coordinates. */
interface IndicatorRect {
  left: number
  width: number
}

const HIDDEN_INDICATOR: IndicatorRect = { left: 0, width: 0 }

const StatusDot = ({ indicator, className }: { indicator: NonNullable<TabItem['indicator']>; className?: string }) => (
  <div className={cn(
    "w-3 h-3 rounded-full border-2 border-ods-bg",
    indicator === 'error' && 'bg-ods-error',
    indicator === 'warning' && 'bg-ods-accent',
    indicator === 'success' && 'bg-ods-success',
    className
  )} />
)

interface TabBarProps {
  tabs: TabItem[]
  activeTab: string
  onTabChange: (tabId: string) => void
  className?: string
  shadowClassName?: string
  showLeftGradient: boolean
  showRightGradient: boolean
  stretchTabs: boolean
}

/**
 * The strip itself — buttons, overflow scrolling, edge fades, underline.
 *
 * Split out of `TabNavigation` for one reason, and it is a performance one: the
 * strip keeps state that changes for reasons having nothing to do with which tab
 * is open (scroll position → edge fades, ResizeObserver → re-measure). While
 * that state lived on `TabNavigation`, every one of those updates re-rendered
 * the component that CALLS the body render prop, so merely scrolling the tab
 * strip on a narrow screen re-rendered whatever heavy table was open underneath.
 * Down here it re-renders only the bar; `TabNavigation` — and the body — never
 * hear about it.
 */
const TabBar = memo(function TabBar({
  tabs,
  activeTab,
  onTabChange,
  className,
  shadowClassName,
  showLeftGradient,
  showRightGradient,
  stretchTabs,
}: TabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeTabRef = useRef<HTMLButtonElement>(null)
  const isFirstActiveScrollRef = useRef(true)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // The underline is ONE element that slides, not a div mounted under whichever
  // tab is active — that version could only ever pop from tab to tab. Position
  // is measured rather than derived from CSS because the tabs are natural-width
  // (label-dependent) and live in a scroll container, so nothing but layout
  // knows where the active one actually is.
  const [indicator, setIndicator] = useState<IndicatorRect>(HIDDEN_INDICATOR)
  // Suppresses the slide for the FIRST placement: a deep link landing on the
  // third tab should not open with the underline gliding in from the left edge.
  const hasPlacedIndicatorRef = useRef(false)

  const measureIndicator = useCallback(() => {
    const active = activeTabRef.current
    // No active tab (unknown id, or an empty tabs array) → collapse it away
    // rather than leaving it under whichever tab it last sat on.
    const next = active ? { left: active.offsetLeft, width: active.offsetWidth } : HIDDEN_INDICATOR
    setIndicator(prev => (prev.left === next.left && prev.width === next.width ? prev : next))
  }, [])

  const updateScrollShadows = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  // Layout effect: the underline's first frame must already be under the right
  // tab. In a passive effect it would paint at the previous position first.
  useLayoutEffect(() => {
    measureIndicator()
  }, [measureIndicator, activeTab, tabs])

  // Flipped only AFTER a real position has been committed, so the transition
  // class is absent for that first paint and present from the next change on.
  useLayoutEffect(() => {
    if (indicator.width > 0) hasPlacedIndicatorRef.current = true
  }, [indicator])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    updateScrollShadows()

    // Translate a vertical mouse wheel into horizontal scroll. macOS mice emit
    // only deltaY, which the browser won't apply to a horizontal-only overflow
    // container, so the strip is otherwise un-scrollable with a plain mouse.
    // Non-passive so preventDefault() can suppress the page from scrolling.
    const onWheel = (e: WheelEvent) => {
      // A trackpad's horizontal gesture (deltaX) already scrolls natively; a
      // pinch-zoom arrives as wheel+ctrlKey — leave both untouched.
      if (e.deltaX !== 0 || e.ctrlKey) return
      if (el.scrollWidth <= el.clientWidth) return
      // deltaY isn't always pixels: Firefox mice report lines (deltaMode 1),
      // some devices pages (mode 2). Normalize so the scroll isn't a no-op.
      const delta = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * el.clientWidth : e.deltaY
      // Only consume the event while there's room to scroll in that direction;
      // at either edge, let it bubble so the page scrolls (native chaining).
      const canGoRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
      const canGoLeft = el.scrollLeft > 0
      if ((delta > 0 && !canGoRight) || (delta < 0 && !canGoLeft)) return
      el.scrollLeft += delta
      e.preventDefault()
    }

    // Scrolling moves the viewport, not the content — `offsetLeft` is unchanged,
    // so only the fades need recomputing. A resize moves both.
    el.addEventListener('scroll', updateScrollShadows, { passive: true })
    el.addEventListener('wheel', onWheel, { passive: false })
    const ro = new ResizeObserver(() => {
      updateScrollShadows()
      measureIndicator()
    })
    ro.observe(el)
    // Web fonts land after first paint and change every label's width, which
    // moves every tab but fires no resize on the strip itself.
    let cancelled = false
    document.fonts?.ready.then(() => { if (!cancelled) measureIndicator() }).catch(() => {})

    return () => {
      cancelled = true
      el.removeEventListener('scroll', updateScrollShadows)
      el.removeEventListener('wheel', onWheel)
      ro.disconnect()
    }
  }, [updateScrollShadows, measureIndicator])

  // Bring the active tab into view when it changes (e.g. clicking a partly
  // off-screen tab, or a URL-driven change). Uses the browser's own smooth
  // scroll and moves ONLY the strip — never the page — by nudging just enough
  // to reveal the tab on whichever edge it's clipped. Complements the native
  // trackpad / Shift+wheel / mouse-wheel scrolling rather than fighting it.
  useEffect(() => {
    const el = scrollRef.current
    const active = activeTabRef.current
    if (!el || !active) return
    // On mount (e.g. a deep link landing on an off-screen tab, such as
    // `?tab=software` as the last of many), snap instantly instead of visibly
    // sliding right after first paint — smooth is reserved for later tab changes.
    const behavior = isFirstActiveScrollRef.current ? 'auto' : 'smooth'
    isFirstActiveScrollRef.current = false
    const elRect = el.getBoundingClientRect()
    const aRect = active.getBoundingClientRect()
    if (aRect.left < elRect.left) {
      el.scrollBy({ left: aRect.left - elRect.left, behavior })
    } else if (aRect.right > elRect.right) {
      el.scrollBy({ left: aRect.right - elRect.right, behavior })
    }
  }, [activeTab])

  const leftFade = canScrollLeft || showLeftGradient
  const rightFade = canScrollRight || showRightGradient

  const borderStyle = useMemo<React.CSSProperties>(() => {
    const c = 'var(--color-border-default)'
    if (leftFade && rightFade) {
      return { background: `linear-gradient(to right, transparent 0, ${c} 40px, ${c} calc(100% - 40px), transparent 100%)` }
    }
    if (leftFade) {
      return { background: `linear-gradient(to right, transparent 0, ${c} 40px, ${c} 100%)` }
    }
    if (rightFade) {
      return { background: `linear-gradient(to right, ${c} 0, ${c} calc(100% - 40px), transparent 100%)` }
    }
    return { background: c }
  }, [leftFade, rightFade])

  // A 1px bar scaled to width, rather than an animated `left`/`width` pair:
  // transform and opacity are the only two properties the compositor can
  // animate without laying the strip out again on every frame.
  const isPlaced = indicator.width > 0
  const indicatorStyle: React.CSSProperties = {
    transform: `translateX(${indicator.left}px) scaleX(${indicator.width})`,
    opacity: isPlaced ? 1 : 0,
  }
  const shouldAnimateIndicator = hasPlacedIndicatorRef.current

  return (
    <div className={cn("relative w-full", className)}>
      {/* scrollbar-hide: tabs stay swipe/wheel-scrollable, bar never shows.
          `relative` makes this the offsetParent the underline is measured against. */}
      <div ref={scrollRef} className="relative flex gap-[var(--spacing-system-xxs)] items-center justify-start h-full overflow-x-auto overflow-y-hidden scrollbar-hide">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              ref={isActive ? activeTabRef : undefined}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex gap-[var(--spacing-system-xxs)] items-center justify-center p-[var(--spacing-system-m)] relative shrink-0 cursor-pointer",
                // Named rather than `transition-all`: the only thing that moves
                // here is colour. `all` also made the browser re-check every
                // property each frame, including the background GRADIENT — which
                // never animated anyway, since the inactive state has no
                // background-image to interpolate from.
                "transition-colors duration-200 bg-transparent border-none outline-none",
                stretchTabs && 'flex-1',
                // Known limitation: ODS color vars hold hex values, so Tailwind
                // alpha modifiers (to-ods-accent/10) silently produce no CSS.
                // color-mix() accepts hex, so we derive the 10%-alpha stop from the token.
                isActive
                  ? 'bg-gradient-to-b from-transparent to-[color-mix(in_srgb,var(--color-accent-primary)_10%,transparent)]'
                  : 'hover:bg-gradient-to-b hover:from-transparent hover:to-[color-mix(in_srgb,var(--color-accent-primary)_10%,transparent)]'
              )}
            >
              {tab.icon ? (
                <div className="relative flex items-center justify-center">
                  <tab.icon
                    className={cn("h-4 w-4 md:h-6 md:w-6 transition-colors", isActive ? 'text-ods-accent' : 'text-ods-text-secondary')}
                  />
                  {tab.indicator && <StatusDot indicator={tab.indicator} className="absolute right-0 top-[-3px]" />}
                </div>
              ) : tab.indicator ? (
                // Text-only tabs keep their status badge — inline dot before
                // the label (there's no icon corner to anchor to).
                <StatusDot indicator={tab.indicator} className="shrink-0" />
              ) : null}

              <span className={cn(
                "text-h4 whitespace-nowrap transition-colors",
                isActive ? 'text-ods-text-primary' : 'text-ods-text-secondary'
              )}>
                {tab.label}
              </span>
            </button>
          )
        })}

        {/* One underline for the whole strip, sliding between tabs. Inside the
            scroll container so it travels with the content; `origin-left` +
            `w-px` make scaleX(n) read as "n pixels wide". */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute bottom-0 left-0 h-1 w-px origin-left bg-ods-accent",
            shouldAnimateIndicator && "transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none"
          )}
          style={indicatorStyle}
        />
      </div>

      {/* Fade shadows — visible when content overflows or when forced via props */}
      {leftFade && (
        <div className={cn("absolute left-0 top-0 bottom-0 w-10 pointer-events-none bg-gradient-to-r to-transparent", shadowClassName || "from-ods-bg")} />
      )}
      {rightFade && (
        <div className={cn("absolute right-0 top-0 bottom-0 w-10 pointer-events-none bg-gradient-to-l to-transparent", shadowClassName || "from-ods-bg")} />
      )}

      {/* Bottom border — a gradient-capable 1px line that fades to transparent on any edge that has an active fade shadow. */}
      <div className="absolute bottom-0 left-0 right-0 h-px pointer-events-none" style={borderStyle} />
    </div>
  )
})

export function TabNavigation({
  activeTab: controlledActiveTab,
  onTabChange: controlledOnTabChange,
  tabs,
  className,
  shadowClassName,
  showRightGradient = false,
  showLeftGradient = false,
  stretchTabs = false,
  urlSync = false,
  defaultTab,
  children
}: TabNavigationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Determine URL sync settings
  const isUrlSyncEnabled = !!urlSync
  const paramName = typeof urlSync === 'object' ? (urlSync.paramName || 'tab') : 'tab'
  const replaceState = typeof urlSync === 'object' ? (urlSync.replaceState !== false) : true

  // Valid tab IDs set
  const validTabIds = useMemo(() => new Set(tabs.map(t => t.id)), [tabs])
  // A string, so the sync effect below depends on a VALUE rather than on the
  // `tabs` array identity — a consumer passing an inline array literal would
  // otherwise re-run that effect on every one of its renders.
  const fallbackTab = defaultTab || tabs[0]?.id || ''

  // What the URL currently says. Read during render (not in the effect) so the
  // effect can compare it against the last value it ACTED on.
  const urlTab = isUrlSyncEnabled ? (searchParams?.get(paramName) || '') : ''

  // Get initial tab value
  const getInitialTab = () => {
    if (isUrlSyncEnabled && validTabIds.has(urlTab)) return urlTab
    return fallbackTab
  }

  // Internal state for URL sync mode
  const [internalActiveTab, setInternalActiveTab] = useState(getInitialTab)

  // Use internal state if URL sync is enabled, otherwise use controlled prop
  const activeTab = isUrlSyncEnabled ? internalActiveTab : (controlledActiveTab || '')

  // The last URL value this component has reconciled with. Writing it in the
  // click handler is what keeps our own `router.replace` from coming back as an
  // "external" change.
  const lastSyncedUrlTabRef = useRef(urlTab)

  // Sync with URL changes (back/forward navigation, a link into a tab).
  //
  // Guarded on the URL VALUE changing, not on `nextTab !== internalActiveTab`.
  // That older comparison also re-ran whenever our own click updated the state,
  // and at that moment `router.replace` has not landed yet — so it read the tab
  // we just left, decided the state was wrong, and pushed the tab BACK, only for
  // the arriving URL to move it forward again. Whether that flicker was visible
  // came down to whether the navigation beat the passive-effect flush.
  useEffect(() => {
    if (!isUrlSyncEnabled) return
    if (urlTab === lastSyncedUrlTabRef.current) return
    lastSyncedUrlTabRef.current = urlTab
    setInternalActiveTab(validTabIds.has(urlTab) ? urlTab : fallbackTab)
  }, [isUrlSyncEnabled, urlTab, validTabIds, fallbackTab])

  // Everything the click handler reads but must not be re-created for. Held in
  // a ref so `handleTabChange` is reference-stable: it is the one prop that
  // would otherwise break `TabBar`'s memo on every navigation, since
  // `searchParams` gets a new identity each time ANY query param moves.
  const navRef = useRef({ isUrlSyncEnabled, controlledOnTabChange, searchParams, pathname, paramName, replaceState })
  navRef.current = { isUrlSyncEnabled, controlledOnTabChange, searchParams, pathname, paramName, replaceState }

  const handleTabChange = useCallback((tabId: string) => {
    const nav = navRef.current

    if (!nav.isUrlSyncEnabled) {
      // Legacy controlled mode
      nav.controlledOnTabChange?.(tabId)
      return
    }

    // The bar follows the click immediately — this update stays urgent.
    setInternalActiveTab(tabId)
    // ...and is what the URL is about to say, so the sync effect treats the
    // arriving param as already reconciled instead of as someone else's change.
    lastSyncedUrlTabRef.current = tabId

    const params = new URLSearchParams(nav.searchParams?.toString())
    params.set(nav.paramName, tabId)
    const method = nav.replaceState ? 'replace' : 'push'
    // Non-urgent: the navigation re-renders every `useSearchParams()` subscriber
    // on the page, which is a lot of work for a query param nobody is waiting
    // on. In a transition it yields to the click feedback instead of competing
    // with it.
    startTransition(() => {
      router[method](`${nav.pathname}?${params.toString()}`)
    })

    nav.controlledOnTabChange?.(tabId)
  }, [router])

  // The tab BAR follows the click immediately; the tab BODY is deferred, which
  // makes React treat swapping it as a transition. That is the whole fix for the
  // flash: a tab whose data is not in the client cache yet SUSPENDS the moment it
  // mounts, and outside a transition React has to show that Suspense fallback —
  // so the skeleton appears for a frame before the real content lands. Inside a
  // transition React keeps the previous tab on screen and swaps only once the new
  // one is ready. Deferring the body rather than the whole state keeps the
  // underline responsive, so the click still feels instant.
  //
  // Two things this asks of the consumer, both worth knowing:
  //  - The render prop runs on BOTH passes (once with the old id, once with the
  //    new). Put anything expensive behind `memo` so the first pass is free.
  //  - A SLOW tab leaves the previous tab's content under the new tab's
  //    underline with nothing saying so — worse than a skeleton, because stale
  //    data reads as fresh data. `isStale` is handed to the render prop so the
  //    body can mark itself while it waits.
  const deferredActiveTab = useDeferredValue(activeTab)
  const isStale = activeTab !== deferredActiveTab

  return (
    <>
      <TabBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        className={className}
        shadowClassName={shadowClassName}
        showLeftGradient={showLeftGradient}
        showRightGradient={showRightGradient}
        stretchTabs={stretchTabs}
      />

      {/* Render children with active tab if provided */}
      {children && children(deferredActiveTab, { isStale })}
    </>
  )
}

// Utility function to get tab by id
export const getTabById = (tabs: TabItem[], tabId: string): TabItem | undefined =>
  tabs.find(tab => tab.id === tabId)

// Utility function to get tab component
export const getTabComponent = (tabs: TabItem[], tabId: string): React.ComponentType<any> | null => {
  const tab = getTabById(tabs, tabId)
  return tab?.component || null
}

'use client'

import * as React from 'react'
import { OverlayScrollbars, type PartialOptions } from 'overlayscrollbars'
import { cn } from '../../utils/cn'

// =============================================================================
// Standardized macOS-like overlay scrollbars on every platform.
//
// OverlayScrollbars hides the native scrollbar and draws a styleable overlay
// one on top while keeping NATIVE scrolling (wheel, touchpad momentum,
// keyboard, drag-the-thumb). With `autoHide` the bar shows only while
// scrolling and fades out when idle — the macOS behavior, now identical on
// Windows/Linux and for mouse users.
//
// Touch devices keep the native scrollbars: mobile bars are already overlay
// and auto-hiding, so the custom layer is initialized only on fine-pointer
// devices (desktop / tablet with a mouse).
// =============================================================================

/** Overlay scrollbars are desktop-only; touch keeps native scrolling. */
const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)'

/** True once mounted on a device with a mouse/trackpad-grade pointer. */
export function useFinePointer(): boolean {
  const [fine, setFine] = React.useState(false)
  React.useEffect(() => {
    const mq = window.matchMedia(FINE_POINTER_QUERY)
    setFine(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setFine(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return fine
}

/** Shared ODS defaults: thin grey thumb, transparent track, show on scroll. */
const ODS_SCROLLBAR_OPTIONS: PartialOptions = {
  scrollbars: {
    theme: 'os-theme-ods',
    autoHide: 'scroll',
    autoHideDelay: 800,
    // Keep the bar visible until the first scroll so keyboard/AT users still
    // get the affordance on freshly opened views.
    autoHideSuspend: true,
  },
}

const setRef = <T,>(ref: React.Ref<T> | undefined, value: T | null) => {
  if (!ref) return
  if (typeof ref === 'function') ref(value)
  else (ref as React.MutableRefObject<T | null>).current = value
}

export interface OverlayScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Sizing/box classes of the scroll container (`flex-1 min-h-0`, `max-h-…`,
   *  borders, background). Do NOT include `overflow-*` here. */
  className?: string
  /** Classes for the scrolling element itself — the content-facing classes of
   *  the old scroller (`flex flex-col gap-…`, paddings). Children are its
   *  direct children, so `gap`/`flex` layout applies exactly as before. */
  contentClassName?: string
  /** Receives the actual scrolling element — use for scrollTop/scrollHeight
   *  logic and as IntersectionObserver root. Set from the first commit, valid
   *  on both the overlay and the native fallback path. */
  viewportRef?: React.Ref<HTMLDivElement>
  /** Extra OverlayScrollbars options merged over the ODS defaults. */
  options?: PartialOptions
  children?: React.ReactNode
}

/**
 * Replacement for an `overflow-auto` scroll container with the standardized
 * ODS overlay scrollbar. Split the old scroller's classes: sizing goes to
 * `className`, content layout to `contentClassName`. The inner scroller div
 * is stable across pointer modes — refs and `onScroll` (via the standard
 * HTML props) keep working like on the plain div it replaces.
 *
 * On touch devices (no fine pointer) the overlay layer is never initialized
 * and the inner div scrolls with its native (already overlay) scrollbar.
 */
export function OverlayScrollArea({
  className,
  contentClassName,
  viewportRef,
  options,
  children,
  ...props
}: OverlayScrollAreaProps) {
  const hostRef = React.useRef<HTMLDivElement>(null)
  const scrollerRef = React.useRef<HTMLDivElement>(null)

  // Serialize to keep the effect dep stable for inline `options` objects.
  const optionsJson = JSON.stringify(options ?? null)

  // Layout effect so the viewport is upgraded before consumers' own layout
  // effects (scroll-fade hooks, observers) measure it.
  React.useLayoutEffect(() => {
    const host = hostRef.current
    const viewport = scrollerRef.current
    if (!host || !viewport) return
    const extra = (JSON.parse(optionsJson) ?? {}) as PartialOptions
    const mq = window.matchMedia(FINE_POINTER_QUERY)
    let instance: ReturnType<typeof OverlayScrollbars> | null = null

    const sync = () => {
      if (mq.matches && !instance) {
        // Our own div is passed as the viewport: children stay inside it and
        // it remains the scrolling element; the library only suppresses its
        // native scrollbar and appends the overlay handles to the host.
        instance = OverlayScrollbars(
          { target: host, elements: { viewport } },
          // `scrollbars` merges one level deep: a caller overriding a single
          // key (e.g. `autoHide`) must not drop the ODS theme and the other
          // defaults with it.
          {
            ...ODS_SCROLLBAR_OPTIONS,
            ...extra,
            scrollbars: { ...ODS_SCROLLBAR_OPTIONS.scrollbars, ...extra.scrollbars },
          },
        )
      } else if (!mq.matches && instance) {
        instance.destroy()
        instance = null
      }
    }

    sync()
    mq.addEventListener('change', sync)
    return () => {
      mq.removeEventListener('change', sync)
      instance?.destroy()
    }
  }, [optionsJson])

  return (
    <div ref={hostRef} className={cn('relative', className)}>
      <div
        ref={(el) => {
          scrollerRef.current = el
          setRef(viewportRef, el)
        }}
        className={cn('h-full w-full overflow-auto', contentClassName)}
        {...props}
      >
        {children}
      </div>
    </div>
  )
}

export interface GlobalOverlayScrollbarsProps {
  /** Extra OverlayScrollbars options merged over the ODS defaults. */
  options?: PartialOptions
}

/**
 * Applies the same overlay scrollbar to the PAGE scroller (`<body>`).
 * Render once near the app root (client side). No-op on touch devices.
 *
 * ONLY mount this on APP-SHELL pages whose body barely scrolls — the real
 * scrolling happens in inner `OverlayScrollArea` containers (openframe-frontend,
 * openframe-chat). Do NOT mount it on long scroll-driven documents: the thumb is
 * repositioned from JS on every scroll frame, so on a page whose main thread is
 * already busy with reveal-on-scroll sections, tickers and marquees the scroll
 * visibly stutters. Measured on multi-platform-hub; raising the update debounce
 * (`update.debounce.mutation`/`resize`) did NOT help, which rules out the
 * observer re-measurement and points at the per-frame cost itself — i.e. it is
 * inherent to any JS-drawn scrollbar, not to this library. Such pages keep the
 * native page scrollbar, styled by the ODS `scrollbar-width`/`scrollbar-color`
 * globals; their inner containers can still use `OverlayScrollArea`.
 */
export function GlobalOverlayScrollbars({ options }: GlobalOverlayScrollbarsProps = {}) {
  const fine = useFinePointer()
  // Serialize to keep the effect dep stable for inline `options` objects.
  const optionsJson = JSON.stringify(options ?? null)

  React.useEffect(() => {
    if (!fine) return
    const extra = (JSON.parse(optionsJson) ?? {}) as PartialOptions
    // Required by OverlayScrollbars for body initialization — suppresses the
    // native scrollbars on both scroll roots before the overlay takes over.
    document.documentElement.setAttribute('data-overlayscrollbars-initialize', '')
    document.body.setAttribute('data-overlayscrollbars-initialize', '')
    const instance = OverlayScrollbars(document.body, {
      ...ODS_SCROLLBAR_OPTIONS,
      ...extra,
      // Same one-level-deep merge as OverlayScrollArea: a caller overriding a
      // single key must not drop the ODS theme (or a tuning preset's siblings).
      scrollbars: { ...ODS_SCROLLBAR_OPTIONS.scrollbars, ...extra.scrollbars },
    })
    return () => {
      instance.destroy()
      document.documentElement.removeAttribute('data-overlayscrollbars-initialize')
      document.body.removeAttribute('data-overlayscrollbars-initialize')
    }
  }, [fine, optionsJson])

  return null
}

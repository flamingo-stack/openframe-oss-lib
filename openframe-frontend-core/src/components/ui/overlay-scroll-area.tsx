'use client'

import * as React from 'react'
import { OverlayScrollbars, type PartialOptions } from 'overlayscrollbars'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import { cn } from '../../utils/cn'

// =============================================================================
// POC: standardized macOS-like overlay scrollbars on every platform.
//
// OverlayScrollbars hides the native scrollbar and draws a styleable overlay
// one on top while keeping NATIVE scrolling (wheel, touchpad momentum,
// keyboard, drag-the-thumb, click-the-track). With `autoHide` the bar shows
// only while scrolling / hovering the host and fades out when idle — the
// macOS behavior, now identical on Windows/Linux and for mouse users.
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

export interface OverlayScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Extra OverlayScrollbars options merged over the ODS defaults. */
  options?: PartialOptions
  children?: React.ReactNode
}

/**
 * Scroll container with the standardized ODS overlay scrollbar.
 *
 * On fine-pointer devices renders `OverlayScrollbarsComponent`; on touch
 * devices (and during SSR / first paint) falls back to a plain
 * `overflow-auto` div with native scrolling. Size the component exactly like
 * the `overflow-auto` div it replaces (`h-…`/`max-h-…`/`flex-1 min-h-0`).
 */
export function OverlayScrollArea({ className, options, children, ...props }: OverlayScrollAreaProps) {
  const fine = useFinePointer()

  if (!fine) {
    return (
      <div className={cn('overflow-auto', className)} {...props}>
        {children}
      </div>
    )
  }

  return (
    <OverlayScrollbarsComponent
      className={className}
      options={{ ...ODS_SCROLLBAR_OPTIONS, ...options }}
      {...props}
    >
      {children}
    </OverlayScrollbarsComponent>
  )
}

/**
 * Applies the same overlay scrollbar to the PAGE scroller (`<body>`).
 * Render once near the app root (client side). No-op on touch devices.
 */
export function GlobalOverlayScrollbars() {
  const fine = useFinePointer()

  React.useEffect(() => {
    if (!fine) return
    // Required by OverlayScrollbars for body initialization — suppresses the
    // native scrollbars on both scroll roots before the overlay takes over.
    document.documentElement.setAttribute('data-overlayscrollbars-initialize', '')
    document.body.setAttribute('data-overlayscrollbars-initialize', '')
    const instance = OverlayScrollbars(document.body, ODS_SCROLLBAR_OPTIONS)
    return () => {
      instance.destroy()
      document.documentElement.removeAttribute('data-overlayscrollbars-initialize')
      document.body.removeAttribute('data-overlayscrollbars-initialize')
    }
  }, [fine])

  return null
}

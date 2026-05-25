'use client'

/**
 * Close a layout-mounted overlay when the URL pathname changes.
 *
 * Why this exists
 * ---------------
 * Modals, drawers, dropdowns, and side panels rendered in the ROOT LAYOUT
 * (siblings of `{children}` in `app/layout.tsx`) DO NOT unmount across
 * same-platform route changes. Their internal `isOpen` state survives every
 * navigation. Most of these overlays apply body-level styles while open —
 * `<body style="pointer-events: none; overflow: hidden">` via Radix's
 * `@radix-ui/react-remove-scroll`, or direct `document.body.style` writes —
 * to lock scroll behind the overlay.
 *
 * If a navigation fires while one of these overlays is open, the body
 * styles stay locked under the new page → unscrollable page, un-clickable
 * floating buttons (`<body>` descendants get `pointer-events:none`
 * inherited), or stale visible backdrops blocking clicks underneath.
 *
 * This hook closes the overlay automatically when the pathname changes,
 * which triggers the overlay's normal close flow (Radix transition,
 * useEffect cleanup, motion exit) → body styles get cleaned up correctly.
 *
 * Skip-first-render semantics
 * ---------------------------
 * The hook only fires `close()` on a REAL pathname change. The very first
 * render after mount has no "previous pathname" to compare against — we
 * track it with a ref and skip the initial call. Without this guard the
 * hook would always invoke `close()` on mount, which is a no-op when the
 * overlay is already closed but masks bugs where `isOpen` defaults to
 * `true` (legitimate UX in some flows).
 *
 * Usage
 * -----
 * The lib version is router-agnostic — the caller threads the current
 * pathname so the hook works under any router (Next.js `usePathname`,
 * react-router `useLocation`, or a vanilla `window.location.pathname`
 * subscription). Hub callers wrap this hook to bind `usePathname()`
 * from `next/navigation`.
 *
 *   // Lib (direct):
 *   useCloseOnNavigation(() => setIsOpen(false), pathname)
 *
 *   // Hub wrapper:
 *   export function useCloseOnNavigation(close: () => void) {
 *     return libUseCloseOnNavigation(close, usePathname())
 *   }
 *
 * Do NOT call this from page-level components — those unmount on
 * navigation already and the close fires for free via the normal
 * useEffect cleanup pattern. This is for the persistent layout shell.
 */

import { useEffect, useRef } from 'react'

export function useCloseOnNavigation(
  close: () => void,
  pathname: string | null,
): void {
  const prevPathnameRef = useRef<string | null>(null)
  // Track whether we've seen the first render. Using a ref instead of
  // a `null` sentinel on prevPathnameRef so callers passing `null` as
  // a legitimate pathname value (server-side / pre-route-resolve) don't
  // get the first-render skip retriggered every time pathname rebinds
  // to null.
  const initializedRef = useRef(false)

  useEffect(() => {
    // First render: just record the starting pathname, do NOT close.
    if (!initializedRef.current) {
      initializedRef.current = true
      prevPathnameRef.current = pathname
      return
    }
    // Subsequent renders: fire close ONLY on a real pathname change.
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname
      close()
    }
    // We intentionally exclude `close` from deps — the caller is expected
    // to pass a stable callback. Including `close` would re-run the effect
    // every render and require every caller to memoize, which is a worse
    // ergonomic trade-off than the documented "stable callback" contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])
}

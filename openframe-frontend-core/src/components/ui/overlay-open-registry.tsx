'use client'

/**
 * A surface-scoped count of overlays (⋯ menus, popovers) currently open INSIDE
 * that surface, so the surface can suspend behaviour that would move the ground
 * under them.
 *
 * ## Why
 *
 * An open menu stays anchored to its trigger. In a chat thread the ground moves
 * on its own: a streaming reply grows the transcript and the auto-scroll follows
 * the bottom, carrying the trigger — and its menu — upward until the menu is
 * pinned to an off-screen anchor at the panel edge, visually detached from the
 * card it belongs to.
 *
 * The honest fix is not to dismiss the menu on every scroll event (that breaks
 * touch, where momentum scrolling fires constantly) but to stop pulling the
 * ground: while an overlay is open the thread stops chasing the bottom, exactly
 * how ChatGPT/Claude stop chasing once you interact with the transcript. When
 * the overlay closes, the thread catches up if it was at the bottom before.
 *
 * ## Wiring
 *
 * Surface: wrap the region in `<OverlayOpenRegistryProvider onOpenChange={…}>`.
 * Overlay: call `useReportOverlayOpen(open)`. No provider → the hook is inert,
 * so overlays outside such a surface behave exactly as before.
 */

import * as React from 'react'

export interface OverlayOpenRegistry {
  /** Register one open overlay; call the returned fn to release it. */
  acquire: () => () => void
}

export const OverlayOpenRegistryContext =
  React.createContext<OverlayOpenRegistry | null>(null)

/** Read the surrounding registry (or `null` when there is no provider). */
export function useOverlayOpenRegistry(): OverlayOpenRegistry | null {
  return React.useContext(OverlayOpenRegistryContext)
}

/**
 * Report this overlay's open state to the surrounding surface. Safe to call
 * unconditionally — with no provider it does nothing.
 */
export function useReportOverlayOpen(open: boolean): void {
  const registry = useOverlayOpenRegistry()
  React.useEffect(() => {
    if (!open || !registry) return
    return registry.acquire()
  }, [open, registry])
}

export interface OverlayOpenRegistryProviderProps {
  /** Fires on 0 → 1 and 1 → 0 transitions only, not on every acquire. */
  onOpenChange?: (hasOpenOverlay: boolean) => void
  children: React.ReactNode
}

/**
 * Owns the count for one surface. The context value is referentially stable, so
 * mounting this provider does not re-render overlays when the count changes —
 * only the surface's own `onOpenChange` callback fires.
 */
export function OverlayOpenRegistryProvider({
  onOpenChange,
  children,
}: OverlayOpenRegistryProviderProps) {
  const countRef = React.useRef(0)
  const onOpenChangeRef = React.useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange

  const registry = React.useMemo<OverlayOpenRegistry>(
    () => ({
      acquire: () => {
        countRef.current += 1
        if (countRef.current === 1) onOpenChangeRef.current?.(true)
        let released = false
        return () => {
          // Guard against a double release (StrictMode double-invokes effect
          // cleanups in development) driving the count negative.
          if (released) return
          released = true
          countRef.current -= 1
          if (countRef.current === 0) onOpenChangeRef.current?.(false)
        }
      },
    }),
    [],
  )

  return (
    <OverlayOpenRegistryContext.Provider value={registry}>
      {children}
    </OverlayOpenRegistryContext.Provider>
  )
}

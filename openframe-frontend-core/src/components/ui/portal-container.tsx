'use client'

import * as React from 'react'

/**
 * The DOM node that Radix overlays (dropdown menus, tooltips) should portal
 * into, instead of the default `document.body`.
 *
 * Portaling to `document.body` lifts content out of every local stacking
 * context, which forces overlays opened *inside* a high-z surface (e.g. the
 * chat drawer) to escalate their own z-index to compete at the document
 * root. Pointing the portal at a node *inside* that surface instead
 * lets the content inherit the surface's stacking context — small, local
 * z-indices then "just work" and no escalation is needed. Radix positions
 * content with `strategy: "fixed"`, so it still escapes ancestor
 * `overflow: hidden` clipping regardless of where it is portaled.
 *
 * Default `null` → Radix falls back to `document.body` (unchanged behaviour
 * everywhere a provider isn't present).
 */
export const PortalContainerContext = React.createContext<HTMLElement | null>(
  null,
)

/** Read the active portal container (or `null` to use `document.body`). */
export function usePortalContainer(): HTMLElement | null {
  return React.useContext(PortalContainerContext)
}

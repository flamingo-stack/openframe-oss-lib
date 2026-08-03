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

/**
 * The element Radix overlays should treat as their COLLISION boundary — the
 * surface they must stay inside of.
 *
 * Separate from {@link PortalContainerContext} on purpose: the portal target is
 * a `display: contents` node (no box, so it can't be measured), while a
 * collision boundary must be a real, laid-out element.
 *
 * Why it matters: Radix positions overlays `position: fixed` and, by default,
 * flips/shifts them against the VIEWPORT. A menu opened near the top of a
 * panel therefore happily grows upward past the panel's edge and lands on top
 * of the app header — visually detached from the surface it belongs to. Handing
 * Radix the panel element instead keeps flip/shift (and the
 * `--radix-popper-available-height` a menu sizes itself by) inside that panel.
 *
 * Default `null` → viewport, i.e. Radix's own default, unchanged everywhere a
 * provider isn't present.
 */
export const CollisionBoundaryContext = React.createContext<HTMLElement | null>(
  null,
)

/** Read the active collision boundary (or `null` for the viewport). */
export function useCollisionBoundary(): HTMLElement | null {
  return React.useContext(CollisionBoundaryContext)
}

/** Padding (px) kept between an overlay and its boundary edge. Matches the
 *  panel's own gutter so a shifted menu never sits flush against the edge. */
export const COLLISION_PADDING_PX = 8

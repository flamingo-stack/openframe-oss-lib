'use client'

import { createContext, useContext } from 'react'

/**
 * Container element that wraps `<main>` and serves as the portal target for
 * `AppLayoutDrawer`. Drawers rendered into this container sit on top of the
 * main content area only — the sidebar and header remain visible and
 * interactive. Null when AppLayout hasn't mounted (or when used outside of it).
 *
 * Lives in its own module (not app-layout.tsx) so in-layout panels
 * (AppLayoutDrawer, NotificationDrawer, TimeTrackerHeaderButton) can consume
 * these contexts without importing AppLayout itself — AppLayout renders those
 * panels, so importing it back would create a module cycle.
 */
export const AppLayoutDrawerContainerContext = createContext<HTMLElement | null>(null)

export function useAppLayoutDrawerContainer(): HTMLElement | null {
  return useContext(AppLayoutDrawerContainerContext)
}

/**
 * Coordination between AppLayout's in-layout panels (`AppLayoutDrawer`, the
 * time-tracker popup) and the mobile burger menu. At most ONE of them may be
 * open at a time — each dims the main area, so stacking them reads as broken:
 *   - a panel that opens calls `notifyDrawerDidOpen(self)` so the layout
 *     closes the burger menu AND every other registered panel;
 *   - each panel registers a close handle so opening the menu via the burger
 *     button (or another panel) closes it. Null outside of AppLayout.
 */
export interface AppLayoutDrawerHandle {
  close: () => void
}

export interface AppLayoutDrawerCoordination {
  /** `self` is skipped when closing the other registered panels. */
  notifyDrawerDidOpen: (self?: AppLayoutDrawerHandle) => void
  /** Returns an unregister cleanup. */
  registerDrawer: (handle: AppLayoutDrawerHandle) => () => void
}

export const AppLayoutDrawerCoordinationContext = createContext<AppLayoutDrawerCoordination | null>(null)

export function useAppLayoutDrawerCoordination(): AppLayoutDrawerCoordination | null {
  return useContext(AppLayoutDrawerCoordinationContext)
}

"use client"

import React, { createContext, useCallback, useContext, useRef, type ReactNode } from 'react'
import type { DocNode } from '../../types/doc-source'

// =============================================================================
// Types
// =============================================================================

export interface DocNavigator {
  /** Base route this navigator owns (e.g., '/knowledge-base', '/data-room'). */
  baseRoute: string
  /** Look up a node in the tree by its storage path (e.g., 'openframe-cli/README.md'). */
  findNodeByPath: (path: string) => DocNode | null
  /** Navigate to a node using the same flow as a sidebar menu click. */
  selectNode: (node: DocNode) => void
}

interface DocNavigationContextValue {
  /**
   * Register a navigator for a `baseRoute`. Returns a cleanup function that
   * removes the navigator from the map IF the slot still owns it (StrictMode-safe).
   * Duplicate registration for the same baseRoute logs a console.warn and replaces.
   */
  register: (nav: DocNavigator) => () => void
  /**
   * Navigate to a path inside whichever registered navigator owns its baseRoute prefix.
   * Returns true if handled, false otherwise (caller falls back to opening in a new tab).
   */
  navigate: (path: string) => boolean
  /** Whether ANY navigator is currently mounted. */
  isAvailable: () => boolean
}

// =============================================================================
// Context
// =============================================================================

const DocNavigationContext = createContext<DocNavigationContextValue | null>(null)

/**
 * Bridges `useDocumentTree` instances (deep in the page tree) to `GlobalAskAI`
 * (high up near the root) without global events or URL parsing.
 *
 * Multi-navigator design: a `Map<baseRoute, DocNavigator>` lets multiple
 * viewers coexist (nested viewers, dual-pane scenarios). Today only one
 * viewer mounts at a time, so behavior is unchanged.
 */
export function DocNavigationProvider({ children }: { children: ReactNode }) {
  const navMap = useRef<Map<string, DocNavigator>>(new Map())

  const register = useCallback((nav: DocNavigator) => {
    const existing = navMap.current.get(nav.baseRoute)
    if (existing && existing !== nav) {
      // eslint-disable-next-line no-console
      console.warn(
        `[DocNavigationContext] duplicate registration for ${nav.baseRoute}; replacing`,
      )
    }
    navMap.current.set(nav.baseRoute, nav)
    return () => {
      // StrictMode-safe identity check: only delete if THIS nav still owns the slot.
      if (navMap.current.get(nav.baseRoute) === nav) {
        navMap.current.delete(nav.baseRoute)
      }
    }
  }, [])

  const findOwningNavigator = useCallback((path: string): DocNavigator | null => {
    // First try: a navigator whose baseRoute is a prefix of `path`. Walks the
    // longest match first so nested routes win over a parent.
    const baseRoutes = Array.from(navMap.current.keys()).sort((a, b) => b.length - a.length)
    for (const baseRoute of baseRoutes) {
      if (path === baseRoute || path.startsWith(`${baseRoute}/`)) {
        return navMap.current.get(baseRoute) ?? null
      }
    }
    // Fallback: a single navigator handles any path (existing behavior — chat
    // chips emit storage paths, not absolute URLs, so prefix matching misses).
    if (navMap.current.size === 1) {
      return navMap.current.values().next().value ?? null
    }
    return null
  }, [])

  const navigate = useCallback(
    (path: string): boolean => {
      const nav = findOwningNavigator(path)
      if (!nav) return false
      const node = nav.findNodeByPath(path)
      if (!node) return false
      nav.selectNode(node)
      return true
    },
    [findOwningNavigator],
  )

  const isAvailable = useCallback(() => navMap.current.size > 0, [])

  const value = React.useMemo(
    () => ({ register, navigate, isAvailable }),
    [register, navigate, isAvailable],
  )

  return <DocNavigationContext.Provider value={value}>{children}</DocNavigationContext.Provider>
}

// =============================================================================
// Hooks
// =============================================================================

export function useDocNavigation(): DocNavigationContextValue {
  const ctx = useContext(DocNavigationContext)
  if (!ctx) {
    // Safe no-op fallback when used outside the provider.
    return {
      register: () => () => {},
      navigate: () => false,
      isAvailable: () => false,
    }
  }
  return ctx
}

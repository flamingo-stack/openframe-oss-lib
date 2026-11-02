'use client';

import React, { createContext, useCallback, useContext, useRef, type ReactNode } from 'react';
import type { DocNode } from '../../types/doc-source';

// =============================================================================
// Types
// =============================================================================

export interface DocNavigator {
  /** Base route this navigator owns (e.g., '/knowledge-base', '/data-room'). */
  baseRoute: string;
  /** Look up a node in the tree by its storage path (e.g., 'openframe-cli/README.md'). */
  findNodeByPath: (path: string) => DocNode | null;
  /** Navigate to a node using the same flow as a sidebar menu click. */
  selectNode: (node: DocNode) => void;
}

interface DocNavigationContextValue {
  /**
   * Register a navigator for a `baseRoute`. Returns a cleanup function that
   * removes the navigator from the map IF the slot still owns it (StrictMode-safe).
   * Duplicate registration for the same baseRoute logs a console.warn and replaces.
   */
  register: (nav: DocNavigator) => () => void;
  /**
   * Navigate to a route under a registered navigator's baseRoute (`/knowledge-base/docs/setup.md`), or a storage path
   * (`docs/setup.md`). Returns true if handled, false otherwise (caller falls back to opening it as a link).
   */
  navigate: (pathOrRoute: string) => boolean;
  /** Whether ANY navigator is currently mounted. */
  isAvailable: () => boolean;
}

// =============================================================================
// Context
// =============================================================================

const DocNavigationContext = createContext<DocNavigationContextValue | null>(null);

/** The tree path a route's tail names: no query or fragment, and decoded as the tree keys it. */
function treePathOfRoute(tail: string): string {
  const path = tail.split(/[?#]/, 1)[0];
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

/**
 * Bridges `useDocumentTree` instances (deep in the page tree) to `GlobalAskAI`
 * (high up near the root) without global events or URL parsing.
 *
 * Multi-navigator design: a `Map<baseRoute, DocNavigator>` lets multiple
 * viewers coexist (nested viewers, dual-pane scenarios). Today only one
 * viewer mounts at a time, so behavior is unchanged.
 */
export function DocNavigationProvider({ children }: { children: ReactNode }) {
  const navMap = useRef<Map<string, DocNavigator>>(new Map());

  const register = useCallback((nav: DocNavigator) => {
    const existing = navMap.current.get(nav.baseRoute);
    if (existing && existing !== nav) {
      console.warn(`[DocNavigationContext] duplicate registration for ${nav.baseRoute}; replacing`);
    }
    navMap.current.set(nav.baseRoute, nav);
    return () => {
      // StrictMode-safe identity check: only delete if THIS nav still owns the slot.
      if (navMap.current.get(nav.baseRoute) === nav) {
        navMap.current.delete(nav.baseRoute);
      }
    };
  }, []);

  const navigate = useCallback((pathOrRoute: string): boolean => {
    // A route under a navigator's baseRoute (walked longest first, so nested routes win over a parent) is that
    // navigator's page: the tree is keyed by the path after the baseRoute, as the address spells it decoded.
    const baseRoutes = Array.from(navMap.current.keys()).sort((a, b) => b.length - a.length);
    for (const baseRoute of baseRoutes) {
      if (pathOrRoute !== baseRoute && !pathOrRoute.startsWith(`${baseRoute}/`)) continue;
      const nav = navMap.current.get(baseRoute);
      const node = nav?.findNodeByPath(treePathOfRoute(pathOrRoute.slice(baseRoute.length + 1)));
      if (!nav || !node) return false;
      nav.selectNode(node);
      return true;
    }
    // A storage path (`openframe-cli/README.md`): the single navigator handles it.
    if (navMap.current.size !== 1) return false;
    const nav = navMap.current.values().next().value;
    const node = nav?.findNodeByPath(pathOrRoute);
    if (!nav || !node) return false;
    nav.selectNode(node);
    return true;
  }, []);

  const isAvailable = useCallback(() => navMap.current.size > 0, []);

  const value = React.useMemo(() => ({ register, navigate, isAvailable }), [register, navigate, isAvailable]);

  return <DocNavigationContext.Provider value={value}>{children}</DocNavigationContext.Provider>;
}

// =============================================================================
// Hooks
// =============================================================================

export function useDocNavigation(): DocNavigationContextValue {
  const ctx = useContext(DocNavigationContext);
  if (!ctx) {
    // Safe no-op fallback when used outside the provider.
    return {
      register: () => () => {},
      navigate: () => false,
      isAvailable: () => false,
    };
  }
  return ctx;
}

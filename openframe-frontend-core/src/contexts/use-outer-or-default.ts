'use client'

/**
 * Outer-forward provider helper — used by hub + embedder providers
 * that supply default runtime values while allowing OUTER providers
 * to override.
 *
 * When an embedder mounts an outer `<ChatRuntimeContext.Provider>`
 * (or `<EndpointsRuntimeContext.Provider>`) ABOVE the hub provider,
 * the outer value wins. When no outer is mounted, the hub provider
 * supplies its `factory()` default. Tree shape stays constant —
 * same provider element at the same position regardless of outer
 * presence — so consumers below never remount when an embedder
 * toggles their providers at runtime.
 *
 * `deps` controls factory memoization:
 *   - Empty `[]` (default) → factory runs ONCE per mount; safe ONLY
 *     when factory closes over module-scope/constant values.
 *   - Non-empty → factory re-runs when deps change. Use when the
 *     factory closes over callbacks or other reactive values
 *     (e.g. hub's ChatRuntime which includes `navigate` +
 *     `decideNewTab` callbacks that depend on router + docNav).
 *
 * Returning the SAME reference across renders is critical for
 * downstream `useMemo` consumers. With empty deps, identity is
 * trivially stable. With reactive deps, the caller must memoize
 * the deps themselves (typically via `useCallback`).
 */

import { useContext, useMemo, type Context } from 'react'

export function useOuterOrDefault<T>(
  context: Context<T | null>,
  factory: () => T,
  deps: ReadonlyArray<unknown> = [],
): T {
  const outer = useContext(context)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are the contract;
  // factory identity is intentionally ignored (caller controls re-creation via deps).
  const fallback = useMemo(factory, deps)
  return outer ?? fallback
}

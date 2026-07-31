'use client'

/**
 * Endpoints runtime — sibling of ChatRuntime. Carries the API path
 * literals consumed by oss-lib components/hooks/utils so a host
 * application can override them (e.g. when running behind a reverse
 * proxy as `user1.openframe.ai` → `/api/mingo-guide/*`).
 *
 * The hub mounts `<HubRuntimeProvider>` at root with the
 * canonical hub paths; an embedded app mounts its own provider with
 * remapped paths. The pattern mirrors ChatRuntimeContext exactly:
 *
 *   - `useEndpointsRuntime()` returns null when no provider is mounted.
 *     For optional consumers that should gracefully no-op without one.
 *   - `useRequiredEndpointsRuntime()` throws on missing provider — for
 *     hooks/components that cannot function without endpoints.
 *
 * IMPORTANT for embedders: memoize the value passed to
 * `<EndpointsRuntimeContext.Provider value={...}>` (e.g. React.useMemo).
 * Reference changes invalidate downstream effect dependency arrays and
 * trigger unnecessary re-fetches.
 */

import { createContext, useContext } from 'react'

export interface EndpointsRuntime {
  /** GET active announcement (used by `<AnnouncementBar>` mount fetch + refocus revalidation). */
  announcementsUrl: string
  accessCode: {
    /** POST validate access code. */
    validateUrl: string
    /** POST consume / redeem access code after registration. */
    consumeUrl: string
  }
  /** POST contact-form submission. */
  contactUrl: string
}

export const EndpointsRuntimeContext = createContext<EndpointsRuntime | null>(null)

/**
 * Optional read — returns null when no provider is mounted. Use for
 * surfaces that should silently skip the fetch (e.g. announcement
 * polling on a page rendered outside the provider tree).
 */
export function useEndpointsRuntime(): EndpointsRuntime | null {
  return useContext(EndpointsRuntimeContext)
}

/**
 * Strict variant — throws on missing provider. Use for consumers that
 * cannot function without an endpoint (form submission, code
 * validation). In tests/Storybook, wrap with the hub's
 * `<HubRuntimeProvider>` or a stub
 * `<EndpointsRuntimeContext.Provider value={mockedEndpoints}>`.
 */
export function useRequiredEndpointsRuntime(): EndpointsRuntime {
  const v = useContext(EndpointsRuntimeContext)
  if (!v) {
    throw new Error(
      '[endpoints-runtime] hook called outside an <EndpointsRuntimeContext.Provider>. ' +
        'Hub: mount <HubRuntimeProvider> in your providers tree. ' +
        'Embedded app: mount your own provider with proxied URLs at the tree root. ' +
        'Tests/Storybook: wrap render() in <EndpointsRuntimeContext.Provider value={mocked}>.',
    )
  }
  return v
}

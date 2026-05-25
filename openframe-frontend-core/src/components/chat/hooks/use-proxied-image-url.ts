'use client'

import { useRequiredChatRuntime } from '../../../contexts/chat-runtime-context'
import { getProxiedImageUrl } from '../../../utils/image-proxy'

/**
 * Hook-version of `getProxiedImageUrl` that reads `proxyPrefix` and
 * `skipDomains` from the ambient `ChatRuntime`. Use anywhere inside
 * a `<ChatRuntimeContext.Provider>`.
 *
 * Returns the input URL (or `''` for null/undefined) when no
 * `imageProxyUrlPrefix` is configured. Always passes `directHttps: true`
 * — callers that need proxied https (e.g. raster-only) must use the pure
 * `getProxiedImageUrl` from `@flamingo-stack/openframe-frontend-core/utils`
 * directly.
 *
 * Rules of hooks: call at the TOP of a component, NOT inside loops/maps.
 * For `.map(item => proxy(item.url))` patterns, use the pure
 * `getProxiedImageUrl` and hardcode the proxy config — the rare
 * non-React-tree caller pattern.
 */
export function useProxiedImageUrl(url: string | null | undefined): string {
  const r = useRequiredChatRuntime()
  return (
    getProxiedImageUrl(url ?? '', {
      proxyPrefix: r.endpoints.imageProxyUrlPrefix,
      skipDomains: r.endpoints.imageProxySkipDomains,
      directHttps: true,
    }) ?? ''
  )
}

import { useCallback } from 'react'
import { useChatRuntime } from '../../contexts/chat-runtime-context'
import type { ResolveLinkResult } from '../../types/doc-source'

/**
 * `useDocsResolveLink(sourceId, override?)` — POST `/api/docs/resolve-link`
 * (or the override / `ChatRuntime.endpoints.docsResolveLinkUrl`) for a
 * relative href inside a doc body, returning a `ResolveLinkResult`
 * envelope.
 *
 * The endpoint chain (`override ?? runtime.endpoints.docsResolveLinkUrl
 * ?? '/api/docs/resolve-link'`) mirrors `searchEndpoint` resolution in
 * `<DocViewer>` so embedders configure both the same way: per-instance
 * prop OR ambient `ChatRuntimeProvider`.
 *
 * The full fetch + JSON-parse pipeline is wrapped in try/catch so a
 * network throw (DNS / CORS / offline) or a non-JSON response surfaces
 * as `{ success: false, error }` — the markdown renderer's broken-link
 * badge handles that branch instead of swallowing an unhandled rejection
 * past the click handler.
 */
export function useDocsResolveLink(
  sourceId: string,
  resolveLinkEndpoint?: string | null,
) {
  const chatRuntime = useChatRuntime()
  const resolvedResolveLinkEndpoint =
    resolveLinkEndpoint ?? chatRuntime?.endpoints.docsResolveLinkUrl ?? '/api/docs/resolve-link'

  return useCallback(
    async (href: string, currentPath: string): Promise<ResolveLinkResult> => {
      try {
        const response = await fetch(resolvedResolveLinkEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ link: href, currentPath, source: sourceId }),
        })
        if (!response.ok) {
          return { success: false, error: `Resolve failed: ${response.status}` }
        }
        const json = await response.json()
        return (json.data ?? json) as ResolveLinkResult
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Resolve failed',
        }
      }
    },
    [resolvedResolveLinkEndpoint, sourceId],
  )
}

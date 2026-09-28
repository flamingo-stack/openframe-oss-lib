import { useCallback } from 'react';
import { useChatRuntime } from '../../contexts/chat-runtime-context';
import type { ResolveLinkResult } from '../../types/doc-source';
import { contentFetch } from '../../utils/embed-content-fetch';

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
/**
 * Narrow the endpoint's answer to a `ResolveLinkResult`.
 *
 * `Response.json()` hands back `any`, and the route answers either the bare
 * result or a `{ data: … }` envelope — so the shape is checked instead of
 * trusted: a non-object body, or a field of the wrong primitive type, degrades
 * to `{ success: false }`, which is the "leave the link alone" branch the
 * markdown renderer already handles.
 *
 * Mirrors `toResolveLinkResult` in `ui/markdown/rich/rich-markdown-renderer`,
 * which narrows the same wire shape for the renderer's own fetch (that copy
 * cannot be imported here — it would pull the whole rich renderer chunk into
 * this hook).
 */
function toResolveLinkResult(body: unknown): ResolveLinkResult {
  if (typeof body !== 'object' || body === null) {
    return { success: false };
  }
  const envelope: Record<string, unknown> = { ...body };
  const inner = envelope.data;
  const fields: Record<string, unknown> = typeof inner === 'object' && inner !== null ? { ...inner } : envelope;
  const readString = (key: string): string | undefined => (typeof fields[key] === 'string' ? fields[key] : undefined);

  return {
    success: fields.success === true,
    resolvedPath: readString('resolvedPath'),
    type: readString('type'),
    action: readString('action'),
    error: readString('error'),
    message: readString('message'),
  };
}

export function useDocsResolveLink(sourceId: string, resolveLinkEndpoint?: string | null) {
  const chatRuntime = useChatRuntime();
  const resolvedResolveLinkEndpoint =
    resolveLinkEndpoint ?? chatRuntime?.endpoints.docsResolveLinkUrl ?? '/api/docs/resolve-link';

  return useCallback(
    async (href: string, currentPath: string): Promise<ResolveLinkResult> => {
      try {
        const response = await contentFetch(resolvedResolveLinkEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ link: href, currentPath, source: sourceId }),
        });
        if (!response.ok) {
          return { success: false, error: `Resolve failed: ${response.status}` };
        }
        const json: unknown = await response.json();
        return toResolveLinkResult(json);
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Resolve failed',
        };
      }
    },
    [resolvedResolveLinkEndpoint, sourceId],
  );
}

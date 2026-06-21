// Single client-side base for every hub call. The prefix itself comes from the
// ONE shared source (proxy/content-prefix.mjs) so a namespace change is one edit.
import { CONTENT_PREFIX } from '../../proxy/content-prefix.mjs'

/** All hub endpoints live under this base; the proxy maps it back to /api/*. */
export const CONTENT = `${CONTENT_PREFIX}/api`

/**
 * In-app route where `<DocsHubPage>` mounts. The single source of truth read
 * by `app-routes.tsx` (the `<Route path>`) AND by `ask-ai.tsx` (the chat's
 * `baseRoute` so markdown chat chips soft-navigate to this same place
 * instead of opening a new tab cross-domain). Change here = both sides
 * follow.
 */
export const DOCS_BASE_ROUTE = '/knowledge-base'

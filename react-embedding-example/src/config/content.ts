// Single client-side base for every hub call. The prefix itself comes from the
// ONE shared source (proxy/content-prefix.mjs) so a namespace change is one edit.
import { CONTENT_PREFIX } from '../../proxy/content-prefix.mjs'

/** All hub endpoints live under this base; the proxy maps it back to /api/*. */
export const CONTENT = `${CONTENT_PREFIX}/api`

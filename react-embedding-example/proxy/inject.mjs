/**
 * The ONE place that knows the path-rewrite + header-injection. Shared by the
 * Vite dev/preview proxy (vite.config.ts) and the standalone Node proxy
 * (proxy/server.mjs). This mirrors exactly what the production Spring Boot
 * proxy does: forward /content/api/* → ${HUB_ORIGIN}/api/*, attaching a
 * platform API key + a fixed impersonated identity so the hub greets that
 * user.
 */
import { CONTENT_PREFIX } from './content-prefix.mjs'

/** Where /content/api/* is forwarded. Default: the local OpenFrame dev hub. */
export const hubTarget = (env) => env.HUB_ORIGIN || 'http://localhost:3000'

/**
 * Strip the /content prefix so /content/api/x?y=1 → /api/x?y=1 (query + encoded
 * chars preserved). Anchored with a (?=/|$) lookahead so '/contentious' is NOT
 * mis-stripped — only an exact /content segment is removed.
 */
export const rewrite = (path) => path.replace(new RegExp(`^${CONTENT_PREFIX}(?=/|$)`), '')

/**
 * CREDENTIAL-FREE by design: auth comes from the CLIENT. The example's
 * `/debug` page stores a platform API key + act-as email in localStorage
 * (`chat.proxy-auth.v1`), and every embedded surface attaches them as
 * `Authorization: Bearer` + `X-Chat-Act-As`; http-proxy/vite forward
 * inbound request headers untouched, so this module only rewrites paths.
 * (The production Spring Boot proxy MAY still inject gateway credentials
 * server-side — that is its deployment's concern, not this example's.)
 */

/**
 * The ONE place that knows the path-rewrite + header-injection. Shared by the
 * Vite dev/preview proxy (vite.config.ts) and the standalone Node proxy
 * (proxy/server.mjs). This mirrors exactly what the production Spring Boot
 * proxy does: forward /content/api/* → ${HUB_ORIGIN}/api/*, attaching the chat
 * secret + a fixed impersonated identity so the hub greets that user.
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
 * Attach the chat secret (Bearer) + the fixed act-as identity headers. Names +
 * scheme match the hub validator (resolveChatProxyIdentity in lib/api/route-base.ts):
 * the avatar must be https. Secret + identity come from server-side env only and
 * never reach the browser bundle (non-VITE_ vars).
 */
export function injectHeaders(proxyReq, env) {
  if (env.CHAT_PROXY_SECRET) {
    proxyReq.setHeader('authorization', `Bearer ${env.CHAT_PROXY_SECRET}`)
  }
  proxyReq.setHeader('x-chat-act-as', env.ACT_AS_EMAIL || 'michael@flamingo.cx')
  proxyReq.setHeader('x-chat-first-name', env.ACT_AS_FIRST_NAME || 'Michael')
  proxyReq.setHeader('x-chat-last-name', env.ACT_AS_LAST_NAME || 'Assraf')
  proxyReq.setHeader(
    'x-chat-avatar-url',
    env.ACT_AS_AVATAR_URL ||
      'https://www.imatest.com/wp-content/uploads/2022/05/Imatest-User-Profile-Brian-Deegan.png',
  )
}

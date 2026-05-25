'use client'

/**
 * Shared `fetch` wrapper for any embedded surface (chat, ticket center,
 * future widgets) that needs to carry the bearer-act-as identity
 * (proxy `Authorization` + `X-Chat-Act-As` headers from
 * `embed-proxy-auth-storage.ts`).
 *
 * Wire header names are `X-Chat-*` for historical reasons — that's a
 * server contract, not a UI namespace. The wrapper itself is generic.
 *
 * Drop-in replacement for `fetch()` — `Authorization` / `X-Chat-Act-As`
 * are merged into `init.headers` when proxy creds are stashed in
 * sessionStorage, otherwise the call falls through to the cookie-auth
 * path unchanged.
 *
 * Use this for any client-side fetch hitting `/api/chat/*`, `/api/docs/chat/*`,
 * or `/api/storage/generate-upload-url` (chat-attachment surface — shared
 * with the ticket center). Routes that do NOT need bearer-act-as
 * (e.g. `/api/profile/me`) keep using vanilla `fetch`.
 */

import { applyProxyAuth } from './embed-proxy-auth-storage'

/**
 * `fetch` wrapper that attaches embed-proxy bearer headers (when
 * present in sessionStorage) and forces `credentials: 'same-origin'`
 * so Supabase auth cookies travel too.
 *
 * **Header merge direction (proxy WINS over caller):** the implementation
 * spreads `baseHeaders` first inside `applyProxyAuth`, then sets the
 * `Authorization` / `X-Chat-*` keys — so the proxy values take precedence
 * over anything the caller passed. The motivation is that the bearer +
 * act-as identity is the source of truth for embedded auth; a caller
 * accidentally passing a stale `Authorization` header should NOT override
 * the live proxy creds.
 *
 * **Cross-origin defense:** the wrapper assumes a same-origin `/api/…`
 * relative URL. Absolute URLs are accepted only when their origin matches
 * the current window's origin; cross-origin URLs throw before the bearer
 * leaves the page. This is a defense-in-depth guard for future call sites
 * — there is no legitimate cross-origin use of this fetch wrapper.
 */
export function embedAuthedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  assertSameOrigin(url)

  // `applyProxyAuth` accepts `Record<string, string>`; normalize the
  // caller's headers to that shape. RequestInit accepts `HeadersInit`
  // which is broader (Headers instance OR array of tuples).
  //
  // When the caller passes no headers, fall back to the same default
  // `applyProxyAuth` uses internally — `Content-Type: application/json` —
  // so JSON POSTs keep their content-type when only `embedAuthedFetch(url)`
  // is used at the call site. GET callers that explicitly want no body
  // headers can pass `init.headers = {}` to opt out.
  let baseHeaders: Record<string, string>
  if (init.headers === undefined) {
    baseHeaders = { 'Content-Type': 'application/json' }
  } else {
    baseHeaders = {}
    if (init.headers instanceof Headers) {
      init.headers.forEach((v, k) => {
        baseHeaders[k] = v
      })
    } else if (Array.isArray(init.headers)) {
      for (const [k, v] of init.headers) baseHeaders[k] = v
    } else {
      Object.assign(baseHeaders, init.headers as Record<string, string>)
    }
  }

  const { url: authedUrl, headers } = applyProxyAuth(url, baseHeaders)
  return fetch(authedUrl, {
    ...init,
    headers,
    // Always include Supabase auth cookies. `applyProxyAuth` handles
    // the bearer header layer; cookies are the session-tier carrier.
    credentials: init.credentials ?? 'same-origin',
  })
}

/**
 * Reject any URL that resolves to a cross-origin destination or to a
 * non-http(s) scheme. Every input is resolved against
 * `window.location.href` so the same rule covers path-only
 * (`/api/...`), absolute (`https://...`), protocol-relative
 * (`//host/...`), AND whitespace-prefixed forms (`\t//evil.com/...`) —
 * the WHATWG fetch spec strips leading ASCII whitespace before
 * parsing, so any regex-based "skip relative" shortcut is bypassable
 * with a leading `\t`/`\n`/`\r`/space. We resolve unconditionally
 * instead and compare origins.
 *
 * Also blocks `javascript:` / `data:` / `blob:` etc. — only `http(s):`
 * is allowed. This is explicit allowlisting rather than relying on
 * `origin === 'null'` to fall out wrong.
 *
 * Server-side rendering: when `typeof window === 'undefined'` we skip
 * the check — the bearer comes from sessionStorage which doesn't exist
 * on the server, so there's nothing to leak anyway.
 */
function assertSameOrigin(url: string): void {
  if (typeof window === 'undefined') return
  let target: URL
  let pageOrigin: string
  try {
    target = new URL(url, window.location.href)
    // Derive the page origin from `href` rather than reading
    // `window.location.origin` directly so the check works in test
    // environments that mock `window.location` to a plain object
    // without an `origin` field (jsdom setups do this).
    pageOrigin = new URL(window.location.href).origin
  } catch {
    throw new Error(`embedAuthedFetch: refusing to fetch malformed URL (${JSON.stringify(url)})`)
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new Error(
      `embedAuthedFetch: refusing non-http(s) URL (${target.protocol}) — pass a relative /api/* path instead`,
    )
  }
  if (target.origin !== pageOrigin) {
    throw new Error(
      `embedAuthedFetch: refusing cross-origin fetch to ${target.origin} — pass a relative /api/* path instead`,
    )
  }
}

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
 * Headers are MERGED: caller-supplied `init.headers` keys override the
 * proxy headers (so a caller explicitly passing `Authorization` wins).
 * In practice `applyProxyAuth` only sets the keys the chat-auth chain
 * cares about and no caller should override those — but the merge
 * direction is documented so a future caller doesn't get a surprise.
 */
export function embedAuthedFetch(url: string, init: RequestInit = {}): Promise<Response> {
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

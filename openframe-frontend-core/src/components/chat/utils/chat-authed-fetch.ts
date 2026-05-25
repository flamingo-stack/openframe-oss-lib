'use client'

/**
 * Shared `fetch` wrapper for chat-side endpoints that need to carry
 * the bearer-act-as identity (proxy `Authorization` + `X-Chat-Act-As`
 * headers from `chat-proxy-auth-storage.ts`).
 *
 * Three call sites today:
 *   - `useEmbeddedChat` — chat-stream + confirm-tool POST.
 *   - `useChatAttachments` — chat-attachment upload-URL mint.
 *   - `useChatIdentity` — capability route GET.
 *
 * Without a unified helper, a future chat endpoint that forgets to call
 * `applyProxyAuth` silently degrades bearer-act-as users to anon.
 *
 * Drop-in replacement for `fetch()` — `Authorization` / `X-Chat-Act-As`
 * are merged into `init.headers` if proxy creds are stashed in
 * localStorage, otherwise the call falls through unchanged.
 *
 * Use this for any client-side fetch hitting `/api/docs/chat/*`,
 * `/api/chat/*`, or `/api/storage/generate-upload-url` (chat-attachment
 * surface). Routes that do NOT need bearer-act-as (e.g.
 * `/api/profile/me`) keep using vanilla `fetch`.
 */

import { applyProxyAuth } from './chat-proxy-auth-storage'

/**
 * `fetch` wrapper that attaches chat-proxy bearer headers (when
 * present in localStorage) and forces `credentials: 'same-origin'`
 * so Supabase auth cookies travel too.
 *
 * Headers are MERGED: caller-supplied `init.headers` keys override the
 * proxy headers (so a caller explicitly passing `Authorization` wins).
 * In practice `applyProxyAuth` only sets the keys our chat auth chain
 * cares about and no caller should override those — but the merge
 * direction is documented so a future caller doesn't get a surprise.
 */
export function chatAuthedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  // `applyProxyAuth` accepts `Record<string, string>`; normalize the
  // caller's headers to that shape. RequestInit accepts `HeadersInit`
  // which is broader (Headers instance OR array of tuples).
  //
  // When the caller passes no headers, fall back to the same default
  // `applyProxyAuth` uses internally — `Content-Type: application/json`
  // — so JSON POSTs keep their content-type when only `applyProxyAuth(url)`
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

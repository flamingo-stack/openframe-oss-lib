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

// =============================================================================
// Host-supplied auth adapter (opt-in)
// =============================================================================

/**
 * Hosts that have their own auth model (cookie sessions, app-specific
 * JWT in localStorage, OAuth access tokens, …) can register an adapter
 * to override the lib's default `embedProxyAuth` flow. When set, the
 * adapter's `getHeaders()` result is merged onto every `embedAuthedFetch`
 * call AFTER the default proxy-auth header step (so adapter headers
 * win over both caller and proxy values), and `credentials` overrides
 * the default `'same-origin'` behaviour.
 *
 * Default (no adapter): MPH-style proxy-impersonation — bearer + act-as
 * read from localStorage, `credentials: 'same-origin'`. No consumer
 * needs to touch this unless they want a different auth model.
 *
 * Use cases:
 *   - openframe-frontend has its own JWT in `localStorage.of_access_token`
 *     and cookie-based session; register an adapter to attach the JWT
 *     and request `credentials: 'include'` so cookies travel cross-origin
 *     to the openframe gateway.
 *   - Future embed hosts with OAuth access tokens, signed URLs, etc.
 *
 * Lifetime: setter is module-level (intentionally — `embedAuthedFetch`
 * is a plain utility, not a hook, so it can't read React context). Host
 * runtime providers should call `setEmbedAuthAdapter(...)` on mount and
 * `setEmbedAuthAdapter(null)` on unmount. Multiple hosts registering at
 * once is a programming error (one chat panel per app).
 */
export interface EmbedAuthAdapter {
  /** Headers merged onto every embedded-fetch call. Return `{}` to add
   *  nothing. Called per-request so reactive token refresh sees the latest
   *  value from your auth store / storage. Values typed as
   *  `string | undefined` so the common narrowed shape
   *  `{ Authorization: token ? 'Bearer …' : undefined }` (or a conditional
   *  `token ? { Authorization: … } : {}`) assigns cleanly — `undefined`
   *  values are filtered before being merged into the request headers. */
  getHeaders?: () => Record<string, string | undefined>
  /** `RequestInit.credentials` mode. Default when no adapter: callers'
   *  `init.credentials` or `'same-origin'`. Use `'include'` for cookie
   *  auth against a different origin (CORS + `SameSite=None` required). */
  credentials?: RequestCredentials
  /**
   * Optional 401 self-heal. When a request comes back `401`,
   * `embedAuthedFetch` calls this once, and — if it resolves `true` —
   * retries the SAME request exactly once with freshly-recomputed
   * headers (so a rotated bearer from `getHeaders()` is picked up).
   * Resolve `false` to surface the 401 to the caller unchanged.
   *
   * This is the capability the openframe `apiClient` has had all along
   * (refresh-the-access-token-then-retry); registering it here gives the
   * embedded chat/ticket surfaces the same self-healing auth instead of
   * dying on an expired token. Concurrent 401s are de-duplicated by the
   * wrapper, so this fires at most once per refresh cycle even when a
   * stampede of chat requests all expire together — your implementation
   * does NOT need its own in-flight guard (though a token-refresh manager
   * that already dedups is harmless).
   *
   * Keep it idempotent and side-effect-light: on failure the wrapper just
   * returns the original 401 — logout/redirect decisions belong to the
   * host's own auth layer, not to this fetch wrapper.
   */
  refresh?: () => Promise<boolean>
  /**
   * Exact extra origins (`scheme://host[:port]`, as produced by `URL.origin`)
   * the same-origin guard additionally accepts. The guard normally rejects
   * every cross-origin URL in production — but native-shell hosts serve the
   * page from a local pseudo-origin (`capacitor://localhost`,
   * `tauri://localhost`) with NO server behind it, so the gateway their
   * bearer already belongs to is unavoidably cross-origin. Listing it here
   * is the host's explicit sanction to send the adapter's credentials there.
   * Compared AFTER the http(s)-protocol check, so non-http(s) schemes can
   * never be allowlisted. Omit (or leave empty) everywhere else — same-origin
   * remains the rule, this is the narrow exception.
   */
  allowedOrigins?: string[]
}

/**
 * The registered adapter is parked on `globalThis`, NOT in a module-private
 * `let`. Reason: this lib ships multiple entry points (`/utils`,
 * `/components/chat`, …) and a consumer's bundler can inline this file into
 * more than one chunk — giving each chunk its OWN module scope. If the host
 * calls `setEmbedAuthAdapter` from the `/utils` copy while the chat's
 * `embedAuthedFetch` runs from the `/components/chat` copy, a module-local
 * `let` would be set on one copy and read as `null` on the other (the exact
 * "credentials: same-origin, no Bearer, no refresh" symptom). A single
 * `globalThis` slot is shared across every copy, so registration always
 * reaches the fetch path.
 */
const ADAPTER_GLOBAL_KEY = '__embedAuthedFetchAdapter__'

function getRegisteredAuthAdapter(): EmbedAuthAdapter | null {
  if (typeof globalThis === 'undefined') return null
  return (globalThis as Record<string, unknown>)[ADAPTER_GLOBAL_KEY] as EmbedAuthAdapter | null ?? null
}

function storeRegisteredAuthAdapter(adapter: EmbedAuthAdapter | null): void {
  if (typeof globalThis === 'undefined') return
  ;(globalThis as Record<string, unknown>)[ADAPTER_GLOBAL_KEY] = adapter
}

/**
 * Register a host-owned auth adapter for `embedAuthedFetch`. Pass `null`
 * to clear (typically on provider unmount).
 *
 * Module-level state — there is one chat panel per app, so a single
 * registration is sufficient. Calling this twice with different non-null
 * adapters replaces the previous one (the most recent registration wins);
 * a `console.warn` flags the overwrite so duplicate-provider mounts get
 * caught in dev.
 */
export function setEmbedAuthAdapter(adapter: EmbedAuthAdapter | null): void {
  if (adapter && getRegisteredAuthAdapter() && process.env.NODE_ENV !== 'production') {
    console.warn(
      '[setEmbedAuthAdapter] overwriting a previously-registered auth ' +
        'adapter. Two chat-runtime providers should not coexist — verify ' +
        'mount order and pass `null` from the unmounting provider.',
    )
  }
  storeRegisteredAuthAdapter(adapter)
}

/**
 * Whether a host auth adapter is currently registered. Lets sibling helpers
 * (e.g. `contentFetch`) route through `embedAuthedFetch` ONLY when a host has
 * opted into embedded auth, and stay a plain `fetch` otherwise — so there's a
 * single auth knob (the adapter), not a second content-fetch registration.
 */
export function hasEmbedAuthAdapter(): boolean {
  return getRegisteredAuthAdapter() !== null
}

/**
 * Whether `url` is an asset the browser CANNOT load natively because its
 * auth rides in request headers: the registered adapter is currently
 * supplying an `Authorization` header AND the URL's origin is one the
 * adapter explicitly sanctions for that bearer (`allowedOrigins` — the
 * host's gateway, cross-origin by construction in native shells).
 *
 * Native asset loads (`<img src>`, CSS `background-image`) can't carry
 * custom headers, so a URL this returns `true` for must go through
 * `embedAuthedFetch` → blob object-URL instead (see `useAuthedImageSrc`).
 * Everything else — cookie-auth web (no Authorization), relative /
 * same-origin URLs (cookies work), third-party origins the bearer does
 * NOT belong to (public images) — loads natively, unchanged.
 */
export function needsBearerAssetFetch(url: string): boolean {
  if (typeof window === 'undefined') return false
  const adapter = getRegisteredAuthAdapter()
  if (!adapter?.allowedOrigins?.length || adapter.getHeaders?.().Authorization === undefined) {
    return false
  }
  let target: URL
  try {
    target = new URL(url, window.location.href)
  } catch {
    return false
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return false
  return adapter.allowedOrigins.includes(target.origin)
}

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
 * the current window's origin — or appears in the registered adapter's
 * `allowedOrigins` (the native-shell hatch; see that field's doc) — and
 * cross-origin URLs otherwise throw before the bearer leaves the page.
 * This is a defense-in-depth guard for future call sites — outside the
 * allowlisted-shell case there is no legitimate cross-origin use of this
 * fetch wrapper.
 *
 * **401 self-heal:** when a registered adapter supplies `refresh`, a `401`
 * response triggers a single token refresh + retry of the same request
 * (see `EmbedAuthAdapter.refresh`). This is the openframe `apiClient`'s
 * refresh-then-retry behaviour, lifted into the lib so embedded surfaces
 * no longer need a host-side `window.fetch` monkey-patch to survive an
 * expired access token mid-chat. With no adapter (or no `refresh`), the
 * 401 passes straight through unchanged.
 */
export function embedAuthedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  // Same-origin guard runs SYNCHRONOUSLY (not awaited inside the async
  // helper below) so a bearer-leaking cross-origin URL throws before any
  // promise is created — callers and tests rely on the synchronous throw.
  assertSameOrigin(url)

  // `applyProxyAuth` accepts `Record<string, string>`; normalize the
  // caller's headers to that shape ONCE, up front. RequestInit accepts
  // `HeadersInit` which is broader (Headers instance OR array of tuples).
  // We re-derive the per-request headers from this base on every attempt
  // (initial + post-refresh retry) so a rotated bearer is picked up.
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

  return fetchWithRefresh(url, init, baseHeaders, false)
}

/**
 * Single in-flight refresh shared across all concurrent `embedAuthedFetch`
 * callers. A stampede of chat requests that all 401 at the same moment must
 * trigger the adapter's `refresh()` ONCE, not N times — otherwise an
 * expiring session fires a thundering herd of refresh calls at the auth
 * server. Resets to `null` once settled so the next genuine expiry can
 * refresh again.
 */
// Stored on `globalThis` rather than a module-local so the "single refresh"
// guarantee survives module duplication. Bundlers can ship more than one copy
// of this module (e.g. across chunks or a host + embedded build); a per-module
// variable would let each copy run its own refresh cycle, re-creating the
// thundering-herd this dedupe exists to prevent.
const IN_FLIGHT_REFRESH_GLOBAL_KEY = '__embedAuthedFetchInFlightRefresh__'

function getInFlightRefresh(): Promise<boolean> | null {
  if (typeof globalThis === 'undefined') return null
  return (
    ((globalThis as Record<string, unknown>)[IN_FLIGHT_REFRESH_GLOBAL_KEY] as
      | Promise<boolean>
      | null
      | undefined) ?? null
  )
}

function setInFlightRefresh(refresh: Promise<boolean> | null): void {
  if (typeof globalThis === 'undefined') return
  ;(globalThis as Record<string, unknown>)[IN_FLIGHT_REFRESH_GLOBAL_KEY] = refresh
}

function dedupedRefresh(): Promise<boolean> {
  const adapter = getRegisteredAuthAdapter()
  if (!adapter?.refresh) return Promise.resolve(false)
  let inFlightRefresh = getInFlightRefresh()
  if (!inFlightRefresh) {
    // Wrap in `Promise.resolve` so an adapter that throws synchronously
    // (rather than rejecting) still funnels through the shared slot and
    // clears it. A rejected refresh is treated as "could not refresh".
    inFlightRefresh = Promise.resolve()
      .then(() => adapter.refresh!())
      .catch(() => false)
      .finally(() => {
        setInFlightRefresh(null)
      })
    setInFlightRefresh(inFlightRefresh)
  }
  return inFlightRefresh
}

/**
 * Core fetch path: merge proxy-auth + adapter headers, issue the request,
 * and — on a `401` with a refresh-capable adapter — refresh once and retry
 * the identical request a single time. Mirrors the openframe `apiClient`'s
 * refresh-then-retry contract (`isRetry` guards against infinite loops).
 */
async function fetchWithRefresh(
  url: string,
  init: RequestInit,
  baseHeaders: Record<string, string>,
  isRetry: boolean,
): Promise<Response> {
  // Re-run the merge each attempt: `applyProxyAuth` reads the latest stored
  // proxy creds and `getHeaders()` reads the latest bearer, so a retry after
  // refresh carries the rotated token rather than the stale one. `{...baseHeaders}`
  // keeps the caller's normalized headers immutable across attempts.
  const { url: authedUrl, headers } = applyProxyAuth(url, { ...baseHeaders })

  // Host-supplied auth adapter layer. Runs AFTER the proxy-auth merge so
  // adapter headers override both caller and proxy values — the adapter
  // is the host's explicit "this is my auth model" override, intentionally
  // last-writer-wins. When no adapter is registered, this is a zero-cost
  // no-op (object spread of `{}`).
  const adapter = getRegisteredAuthAdapter()
  if (adapter?.getHeaders) {
    // Filter `undefined` values — the adapter type allows them so consumers
    // don't have to narrow `{ Authorization: token ? '…' : undefined }`-shaped
    // returns, but `fetch` headers must be strings.
    for (const [k, v] of Object.entries(adapter.getHeaders())) {
      if (v !== undefined) headers[k] = v
    }
  }
  const credentials = adapter?.credentials ?? init.credentials ?? 'same-origin'

  const response = await fetch(authedUrl, {
    ...init,
    headers,
    // Default `same-origin` carries Supabase cookies for the MPH proxy-
    // auth model. Hosts on different origins (openframe-frontend ↔
    // openframe gateway) register `credentials: 'include'` via the
    // adapter to make their own cookies travel cross-origin (CORS +
    // `SameSite=None` must be configured server-side for that to work).
    credentials,
  })

  // 401 self-heal: refresh the token once and retry. Only when an adapter
  // opted into `refresh`, and only on the first attempt — a 401 on the
  // retry means the fresh token is also unauthorized, so surface it.
  if (response.status === 401 && !isRetry && adapter?.refresh) {
    const refreshed = await dedupedRefresh()
    if (refreshed) {
      return fetchWithRefresh(url, init, baseHeaders, true)
    }
  }

  return response
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
    // Host-sanctioned cross-origin target (`EmbedAuthAdapter.allowedOrigins`).
    // Native shells serve the page from a local pseudo-origin with no server
    // behind it, so their gateway — the same backend the host already trusts
    // with this bearer — is unavoidably cross-origin. Exact `URL.origin`
    // match, and only reachable for http(s) targets (checked above).
    if (getRegisteredAuthAdapter()?.allowedOrigins?.includes(target.origin)) {
      return
    }
    // Dev-mode escape hatch — embedded apps (e.g. openframe-frontend)
    // run on a different origin from their gateway during local dev,
    // and forcing a Next.js `rewrites()` workaround is more error-prone
    // than relaxing the guard for the dev build. In production
    // (`NODE_ENV === 'production'`) the guard stays absolute — same
    // defense-in-depth bearer-leak protection as before. The check is
    // baked at build time by Next/webpack/Turbopack so prod bundles
    // contain only the throwing branch (no dev string in the artifact).
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `[embedAuthedFetch] cross-origin fetch to ${target.origin} ` +
          `allowed in dev (NODE_ENV !== 'production'). Production builds ` +
          `will reject this — wire a same-origin proxy before shipping.`,
      )
      return
    }
    throw new Error(
      `embedAuthedFetch: refusing cross-origin fetch to ${target.origin} — pass a relative /api/* path instead`,
    )
  }
}

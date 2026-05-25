'use client'

/**
 * Client-side persistence for embed-surface proxy credentials
 * (`CHAT_PROXY_SECRET` + impersonation email). Used by every embedded
 * surface — the chat widget AND the ticket center AND any future
 * embedded React component that needs to identify itself as the
 * impersonated customer.
 *
 * When set, the surface attaches the creds as
 *   `Authorization: Bearer <secret>` + `X-Chat-Act-As: <email>`
 * on every call to `/api/docs/chat`, `/api/chat/*`, and any other route
 * gated by `requireChatAuth` — proving to the server that this session
 * is acting on behalf of <email>.
 *
 * **Naming history:** the wire-side header names are still `X-Chat-*`
 * and the env var is `CHAT_PROXY_SECRET`. Those are server contracts;
 * renaming them would require a coordinated deploy + customer-side
 * env-var migration. The CLIENT-side helpers were renamed `Embed*` so
 * non-chat surfaces (e.g. ticket center) don't have to import a
 * chat-prefixed symbol just to send the same headers.
 *
 * Persists to **`sessionStorage`** (not `localStorage`) so the bearer
 * token and act-as identity evaporate when the tab closes. An XSS sink
 * on this origin can still exfiltrate the value while the tab is open
 * (impossible to avoid without server-side opaque tokens), but the
 * exposure window shrinks from "indefinite" to "current tab session"
 * which is an order of magnitude better. Admin-only by convention —
 * the `/debug` admin route hosts the paste-creds UI and is gated
 * behind the platform's `askAI.enabled` flag.
 *
 * Namespaced under `<platform>.chat.proxy-auth.v1` (the storage key is
 * unchanged from the old chat-prefixed helper — that's a storage
 * contract; renaming it would log everyone out).
 */

import { createLocalStorageAdapter } from './local-storage-adapter'
import { getAppType } from './app-config'

export interface EmbedProxyAuth {
  secret: string
  email: string
  /** Optional identity passthrough — empty/omitted = not sent. Server
   *  parses these as `X-Chat-{First,Last}-Name` / `X-Chat-Avatar-Url` and
   *  threads them through `resolveChatProxyIdentity`'s returned user. */
  firstName?: string
  lastName?: string
  avatarUrl?: string
}

function isValidPersistedAuth(value: unknown): value is EmbedProxyAuth {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (
    typeof v.secret !== 'string' || v.secret.trim().length === 0 ||
    typeof v.email !== 'string' || v.email.trim().length === 0
  ) return false
  // Optional fields: when present must be strings. Empty string is treated
  // as absent later (in `getEmbedProxyAuth`).
  if (v.firstName != null && typeof v.firstName !== 'string') return false
  if (v.lastName != null && typeof v.lastName !== 'string') return false
  if (v.avatarUrl != null && typeof v.avatarUrl !== 'string') return false
  return true
}

const adapter = createLocalStorageAdapter<EmbedProxyAuth>({
  // Storage key unchanged from the legacy chat-prefixed helper. Renaming
  // it would silently log every existing admin out — the key is a
  // storage contract, not a code identifier.
  key: 'chat.proxy-auth.v1',
  namespace: () => getAppType(),
  validate: isValidPersistedAuth,
  logTag: '[embed-proxy-auth-storage]',
  // sessionStorage — cleared when the tab closes. Bearer token + act-as
  // identity should NOT outlive the current session, so localStorage's
  // indefinite persistence is the wrong choice here. See file-level
  // doc comment for the threat-model rationale.
  backend: 'session',
})

/** Trim + null-coerce an optional identity field so consumers can do
 *  `auth.firstName ?? ''` without worrying about whitespace-only strings. */
function normalizeOptional(value: string | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * Returns full credentials (secret + email + optional identity passthrough)
 * when secret + email are available. Returns `null` when nothing is saved —
 * callers treat that as "fall back to cookie auth".
 */
export function getEmbedProxyAuth(): EmbedProxyAuth | null {
  const persisted = adapter.load()
  if (!persisted) return null
  return {
    secret: persisted.secret,
    email: persisted.email.trim().toLowerCase(),
    firstName: normalizeOptional(persisted.firstName),
    lastName: normalizeOptional(persisted.lastName),
    avatarUrl: normalizeOptional(persisted.avatarUrl),
  }
}

/**
 * Returns the LAST email the admin saved. The proxy creds bar reads
 * this to pre-fill the email field on mount.
 */
export function getPersistedProxyEmail(): string | null {
  const persisted = adapter.load()
  return persisted?.email.trim().toLowerCase() ?? null
}

/** Save the proxy creds. Secret + email are required; identity-passthrough
 *  fields are persisted only when non-empty. */
export function setEmbedProxyAuth(value: EmbedProxyAuth): void {
  adapter.save({
    secret: value.secret,
    email: value.email.trim().toLowerCase(),
    firstName: normalizeOptional(value.firstName),
    lastName: normalizeOptional(value.lastName),
    avatarUrl: normalizeOptional(value.avatarUrl),
  })
}

/** Drop the persisted creds. */
export function clearEmbedProxyAuth(): void {
  adapter.clear()
}

/**
 * Apply the embed-proxy auth (Bearer + X-Chat-Act-As) to a fetch call's
 * URL + headers. Used by every embedded-surface route that needs to
 * identify itself as the proxied customer (chat stream, agent-* routes,
 * ticket-center actions). When proxy auth is absent (regular
 * cookie-session users), returns the inputs unchanged so the cookie-auth
 * path still works.
 *
 * `X-Chat-Act-As` header (vs a URL query param) keeps PII out of access
 * logs, Sentry breadcrumbs, browser history, and CDN analytics.
 */
export function applyProxyAuth(
  url: string,
  baseHeaders: Record<string, string> = { 'Content-Type': 'application/json' },
): { url: string; headers: Record<string, string> } {
  const auth = getEmbedProxyAuth()
  const headers = { ...baseHeaders }
  if (auth?.secret) {
    headers.Authorization = `Bearer ${auth.secret}`
  }
  if (auth?.email) {
    headers['X-Chat-Act-As'] = auth.email
  }
  // Optional identity passthrough — only attached when present so the
  // server's "required vs optional" header shape stays exact.
  if (auth?.firstName) headers['X-Chat-First-Name'] = auth.firstName
  if (auth?.lastName) headers['X-Chat-Last-Name'] = auth.lastName
  if (auth?.avatarUrl) headers['X-Chat-Avatar-Url'] = auth.avatarUrl
  return { url, headers }
}

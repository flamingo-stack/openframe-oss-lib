'use client'

/**
 * Client-side persistence for the chat-proxy credentials
 * (`CHAT_PROXY_SECRET` + impersonation email). When set, the chat widget
 * attaches them as `Authorization: Bearer <secret>` + `X-Chat-Act-As: <email>`
 * on every call to `/api/docs/chat` and `/api/chat/agent/*` — proving to
 * the server that this session is acting on behalf of <email>.
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
 * Namespaced under `<platform>.chat.proxy-auth.v1` so switching
 * `NEXT_PUBLIC_APP_TYPE` mid-session doesn't drag stale creds across
 * surfaces.
 */

import { createLocalStorageAdapter } from '../../../utils/local-storage-adapter'
import { getAppType } from '../../../utils/app-config'

export interface ChatProxyAuth {
  secret: string
  email: string
  /** Optional identity passthrough — empty/omitted = not sent. Server
   *  parses these as `X-Chat-{First,Last}-Name` / `X-Chat-Avatar-Url` and
   *  threads them through `resolveChatProxyIdentity`'s returned user. */
  firstName?: string
  lastName?: string
  avatarUrl?: string
}

function isValidPersistedAuth(value: unknown): value is ChatProxyAuth {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (
    typeof v.secret !== 'string' || v.secret.trim().length === 0 ||
    typeof v.email !== 'string' || v.email.trim().length === 0
  ) return false
  // Optional fields: when present must be strings. Empty string is treated
  // as absent later (in `getChatProxyAuth`).
  if (v.firstName != null && typeof v.firstName !== 'string') return false
  if (v.lastName != null && typeof v.lastName !== 'string') return false
  if (v.avatarUrl != null && typeof v.avatarUrl !== 'string') return false
  return true
}

const adapter = createLocalStorageAdapter<ChatProxyAuth>({
  key: 'chat.proxy-auth.v1',
  // Namespace by platform so a developer switching `NEXT_PUBLIC_APP_TYPE`
  // mid-session doesn't drag stale creds across surfaces.
  namespace: () => getAppType(),
  validate: isValidPersistedAuth,
  logTag: '[chat-proxy-auth-storage]',
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
 * when secret + email are available in localStorage. Survives page reloads.
 * Returns `null` when nothing is saved — callers treat that as "fall back
 * to cookie auth".
 */
export function getChatProxyAuth(): ChatProxyAuth | null {
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
 * Returns the LAST email the admin saved. The bar reads this to pre-fill
 * the email field on mount.
 */
export function getPersistedProxyEmail(): string | null {
  const persisted = adapter.load()
  return persisted?.email.trim().toLowerCase() ?? null
}

/** Save the proxy creds to localStorage. Secret + email are required;
 *  identity-passthrough fields are persisted only when non-empty. */
export function setChatProxyAuth(value: ChatProxyAuth): void {
  adapter.save({
    secret: value.secret,
    email: value.email.trim().toLowerCase(),
    firstName: normalizeOptional(value.firstName),
    lastName: normalizeOptional(value.lastName),
    avatarUrl: normalizeOptional(value.avatarUrl),
  })
}

/** Drop the persisted creds. */
export function clearChatProxyAuth(): void {
  adapter.clear()
}

/**
 * Apply the chat-proxy auth (Bearer + X-Chat-Act-As) to a fetch call's
 * URL + headers. Used by every chat-side route that needs to identify
 * itself as the proxied customer (the docs chat stream AND every
 * confirm-tool / agent-* route the chat shell calls afterwards). When
 * proxy auth is absent (regular cookie-session users), returns the
 * inputs unchanged so the cookie-auth path still works.
 *
 * `X-Chat-Act-As` header (vs a URL query param) keeps PII out of
 * access logs, Sentry breadcrumbs, browser history, and CDN analytics.
 */
export function applyProxyAuth(
  url: string,
  baseHeaders: Record<string, string> = { 'Content-Type': 'application/json' },
): { url: string; headers: Record<string, string> } {
  const auth = getChatProxyAuth()
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

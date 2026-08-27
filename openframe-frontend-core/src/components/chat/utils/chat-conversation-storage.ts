/**
 * Chat conversation-id persistence — the SSE/Guide chat's ONLY local state.
 *
 * The stored value is the SERVER-minted conversation id echoed in the chat
 * stream's leading metadata frame; the client never generates ids. Message
 * history itself lives server-side (`chat_conversations` / `chat_messages`)
 * and is rehydrated via the history endpoint — see
 * `use-chat-history-hydration.ts`.
 *
 * Built on the lib-standard `createLocalStorageAdapter` (SSR guard,
 * try/catch, quota-failure logging, dynamic namespacing) instead of raw
 * `window.localStorage`. The namespace resolver runs on EVERY read/write, so
 * a proxy-auth identity switch mid-page automatically re-partitions the key.
 *
 * Key shape: `mingo-chat-<source>[-u-<email>].conversation`
 */

import {
  createLocalStorageAdapter,
  type LocalStorageAdapter,
} from '../../../utils/local-storage-adapter'
import { getEmbedProxyAuth } from '../../../utils/embed-proxy-auth-storage'

export interface PersistedChatConversation {
  conversationId: string
}

const STORAGE_KEY = 'conversation'

const namespaceFor = (source: string): string => {
  const base = `mingo-chat-${source}`
  const auth = getEmbedProxyAuth()
  return auth?.email ? `${base}-u-${encodeURIComponent(auth.email.toLowerCase())}` : base
}

/** One adapter per chat `source` (= platform). Memoize per mount. */
export function createChatConversationStorage(
  source: string,
): LocalStorageAdapter<PersistedChatConversation> {
  return createLocalStorageAdapter<PersistedChatConversation>({
    key: STORAGE_KEY,
    namespace: () => namespaceFor(source),
    validate: (parsed): parsed is PersistedChatConversation =>
      !!parsed &&
      typeof (parsed as PersistedChatConversation).conversationId === 'string' &&
      (parsed as PersistedChatConversation).conversationId.length > 0,
    logTag: '[chat-conversation-storage]',
  })
}

/**
 * Sweep THIS source's stale keys: the other-identity variants (base vs
 * impersonation), and retired key shapes from before the server-minted-id
 * design (raw `mingo-chat-<source>` and versioned `-v1`/`-v2` full-history
 * stores). Boundary-aware: a hyphen-extended sibling source (`flamingo` vs
 * `flamingo-teaser`) is NOT this source's namespace and must never be swept.
 *
 * Raw storage enumeration is unavoidable here — the adapter abstraction is
 * per-key and Web Storage only exposes iteration on the raw object.
 */
export function pruneStaleChatConversationStorage(source: string): void {
  if (typeof window === 'undefined') return
  try {
    const base = `mingo-chat-${source}`
    const currentKey = `${namespaceFor(source)}.${STORAGE_KEY}`
    const ownedKey = (k: string) =>
      k === base || // retired raw key (pre-adapter shape)
      k === `${base}.${STORAGE_KEY}` || // current no-identity shape
      k.startsWith(`${base}-u-`) || // per-identity shapes (current + retired)
      k.startsWith(`${base}-v`) // retired versioned full-history shapes
    const toRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (!k) continue
      if (ownedKey(k) && k !== currentKey) toRemove.push(k)
    }
    for (const k of toRemove) {
      window.localStorage.removeItem(k)
    }
  } catch {
    // localStorage access blocked (Safari private mode etc.) — non-fatal.
  }
}

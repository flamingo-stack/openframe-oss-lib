'use client'

/**
 * @deprecated The canonical implementation lives at
 * `@flamingo-stack/openframe-frontend-core/utils` as `embed-proxy-auth-storage.ts`.
 *
 * This shim preserves the legacy `chat-`-prefixed export names so existing
 * chat-namespace callers keep compiling. New code should import from
 * `…/utils` directly:
 *
 *   import { embedAuthedFetch, getEmbedProxyAuth } from '@flamingo-stack/openframe-frontend-core/utils'
 *
 * Wire headers (`X-Chat-Act-As`, etc.) and the storage key
 * (`chat.proxy-auth.v1`) are unchanged — those are deployment contracts
 * the rename intentionally does NOT touch.
 */

export {
  type EmbedProxyAuth as ChatProxyAuth,
  getEmbedProxyAuth as getChatProxyAuth,
  setEmbedProxyAuth as setChatProxyAuth,
  clearEmbedProxyAuth as clearChatProxyAuth,
  getPersistedProxyEmail,
  applyProxyAuth,
} from '../../../utils/embed-proxy-auth-storage'

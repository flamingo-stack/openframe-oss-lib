/**
 * `UnifiedChatMessage` (what the chat state produces, and what a host like
 * Mingo hands in) → `Message` (what the thread renders).
 *
 * The two types overlap but are not the same: this step resolves the role's
 * default name and avatar, folds `segments` back into `content`, and stamps a
 * timestamp for rows that arrived without one. So it is a REBUILD, and a
 * rebuild names every field it keeps — which makes "a new field was added
 * upstream" a silent data loss by default, not a compile error.
 *
 * It has cost us that twice already. `hidden` was dropped here, and a synthetic
 * directive the reader was never meant to see rendered as an ordinary bubble.
 * Then Guide Mode's `sources` / `refs` were dropped here, and every answer lost
 * its citation strip while its cards fell back to being titled by their own id
 * — with the decoder, the reducer and the renderer all working correctly, which
 * is exactly why it took a screenshot diff to find.
 *
 * Hence this module: pure, cheap to render-free test, and the one place the
 * pass-through list is pinned.
 */

import type { Message } from '../types/message.types';
import type { UnifiedChatMessage } from '../types/unified-chat-state.types';

export interface HostMessageMapOptions {
  /** Display name for `user` rows when the host supplies none. */
  userName?: string;
  /** Avatar for `user` rows when the host supplies none. */
  userAvatar?: string;
  /**
   * Fallback timestamps for rows that carry none, keyed by message id. Mutated:
   * a row must keep the SAME fallback across renders, or its bubble re-stamps
   * itself on every keystroke elsewhere in the thread.
   */
  timestampCache: Map<string, Date>;
}

export function mapHostMessage(m: UnifiedChatMessage, options: HostMessageMapOptions): Message {
  const { userName, userAvatar, timestampCache } = options;

  let timestamp: Date;
  if (m.timestamp != null) {
    timestamp = new Date(m.timestamp);
  } else {
    const cached = timestampCache.get(m.id);
    timestamp = cached ?? new Date();
    if (!cached) timestampCache.set(m.id, timestamp);
  }

  return {
    id: m.id,
    role: m.role,
    // Host-supplied per-message name/avatar win (e.g. the signed-in user's
    // full name + photo on a `user` bubble); fall back to the role default
    // when the host doesn't provide them.
    name: m.name ?? (m.role === 'assistant' ? 'Mingo' : (userName ?? 'You')),
    avatar: m.avatar ?? (m.role === 'user' ? (userAvatar ?? null) : null),
    // Forward the host's authorType so user bubbles get the same accent
    // name color as the standalone /mingo page (user → 'admin').
    ...(m.authorType ? { authorType: m.authorType } : {}),
    content: m.segments && m.segments.length > 0 ? m.segments : m.content,
    timestamp,
    assistantType: m.role === 'assistant' ? ('mingo' as const) : undefined,
    // `hidden` is load-bearing, NOT cosmetic: it carries synthetic rows
    // (e.g. an auto-continuation directive) that the LLM must see but the
    // reader must not. See the module note above.
    ...(m.hidden ? { hidden: true } : {}),
    ...(m.scrollAnchor ? { scrollAnchor: m.scrollAnchor } : {}),
    // Forward attached context items so the user bubble renders its chips.
    ...(m.contextItems && m.contextItems.length > 0 ? { contextItems: m.contextItems } : {}),
    // Per-answer source metadata: the citation strip under the answer, and the
    // descriptions the `[card://…]` markers in its body expand into.
    ...(m.sources && m.sources.length > 0 ? { sources: m.sources } : {}),
    ...(m.refs && m.refs.length > 0 ? { refs: m.refs } : {}),
  };
}

/**
 * Drop cached fallback timestamps for messages no longer in the thread, so the
 * map cannot grow unbounded across a long-lived session.
 */
export function pruneTimestampCache(timestampCache: Map<string, Date>, liveIds: Set<string>): void {
  if (timestampCache.size <= liveIds.size) return;
  for (const id of timestampCache.keys()) {
    if (!liveIds.has(id)) timestampCache.delete(id);
  }
}

'use client'

/**
 * Chat-panel-local context.
 *
 * The chat shell (EmbeddableChat) provides a small set of panel-level
 * affordances that descendants — including inline cards rendered via
 * the dispatcher — may want to consume WITHOUT prop drilling:
 *
 *   - `closeChat()` — close the chat panel. Inline cards trigger this
 *     ONLY when their navigation is same-tab (so new-tab clicks leave
 *     the chat open while the new tab loads).
 *
 * Why context vs prop drilling: the card dispatch has 7+ wrappers
 * (BlogCard, ProgramCard, DataRoomDocCard, …). Threading `onClose`
 * through every wrapper signature would touch every card type for one
 * UX behavior — not worth the churn. Context is opt-in at the
 * provider level and zero-cost when not consumed.
 *
 * Defaults to `null` when no provider is mounted (e.g. tests, or a
 * card rendered outside the panel) — consumers MUST handle `null`.
 */

import { createContext, useContext } from 'react'

export interface ChatPanelHandle {
  /** Close the chat panel. Called by inline cards' nav click handler
   *  ONLY when the resolved navigation is same-tab. */
  closeChat: () => void
}

export const ChatPanelContext = createContext<ChatPanelHandle | null>(null)

/** Optional consumer — returns `null` when no provider mounted. */
export function useChatPanel(): ChatPanelHandle | null {
  return useContext(ChatPanelContext)
}

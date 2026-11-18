'use client';

/**
 * The chat engine a host runs once for a session, handed to every chat surface below it.
 *
 * A host whose chat outlives any one panel (OpenFrame: the dock, the sidebar's history, the phone's chat list and the
 * approvals all read one dialog list, and the open dialog has one live tail) runs `useChatEngine` once, where the
 * session lives, and provides the result here. `EmbeddableChat` below it draws that engine in its agent mode instead of
 * running its own, so there is never a second list, a second tail or a second thread.
 *
 * What the panel does with its sends is the engine's (its config: the transport, the history, the link to copy); what
 * the host does around a send (open the sheet, follow a chat a send created) is `EmbeddableChat`'s `onMessageSent` and
 * `onDialogCreated`.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { UnifiedChatState } from '../types/unified-chat-state.types';

const ChatEngineContext = createContext<UnifiedChatState | null>(null);

export interface ChatEngineProviderProps {
  /** What `useChatEngine` returned, as it returned it. */
  engine: UnifiedChatState;
  children?: ReactNode;
}

export function ChatEngineProvider({ engine, children }: ChatEngineProviderProps) {
  return <ChatEngineContext.Provider value={engine}>{children}</ChatEngineContext.Provider>;
}

/** The engine a host provided above, or null: a panel with none runs its own. */
export function useChatEngineContext(): UnifiedChatState | null {
  return useContext(ChatEngineContext);
}

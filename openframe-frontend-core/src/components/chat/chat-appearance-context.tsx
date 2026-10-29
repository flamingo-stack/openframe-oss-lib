'use client';

import { createContext, useContext } from 'react';
import { CHAT_APPEARANCE, type ChatAppearance } from './types/chat.types';

/**
 * Thread-wide `ChatAppearance`. `ChatMessageList` provides it, so the blocks a
 * message renders (error, lifecycle receipts) follow the thread without every
 * segment component growing an `appearance` prop.
 */
export const ChatAppearanceContext = createContext<ChatAppearance>(CHAT_APPEARANCE.CLASSIC);

export function useChatAppearance(): ChatAppearance {
  return useContext(ChatAppearanceContext);
}

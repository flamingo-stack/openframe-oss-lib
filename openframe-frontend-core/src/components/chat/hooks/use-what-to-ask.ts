'use client';

import { useCallback, useState } from 'react';
import {
  approvalStatusOf,
  isToolPart,
  type ChatMessage,
  type ChatMessageAuthor,
  type ChatSuggestionGroup,
} from '../../../chat-protocol/chat-message';
import { approvalDisplaysInline } from '../utils/approval-display';

/**
 * The "What to ask?" exchange: the question the user is shown asking, and the
 * assistant's answer, a line of text over grouped prompt chips.
 */
export interface WhatToAskContent {
  /** The user's side, e.g. "What can I ask you?". */
  question: string;
  /** The answer's text (markdown), above the chips. */
  reply: string;
  groups: ChatSuggestionGroup[];
  /** A line under the chips, e.g. how picking one works. */
  note?: string;
}

/** Who a side of the exchange is shown as. */
export type WhatToAskAuthor = ChatMessageAuthor;

export interface UseWhatToAskOptions {
  /** The open conversation; `null` for a new chat that has no dialog yet. */
  dialogId: string | null | undefined;
  /** What an exchange shows unless `ask` is handed its own. */
  content?: WhatToAskContent;
  user?: WhatToAskAuthor;
  assistant?: WhatToAskAuthor;
}

export interface WhatToAsk {
  /**
   * Show the exchange: at the end of the open conversation (`'current'`), or
   * in the new chat (`'draft'`), which then reads as a conversation until it
   * is sent or left. `content` overrides the hook's for this exchange (e.g.
   * prompts built from live data); each exchange keeps what it was shown
   * with. No-op without either.
   */
  ask: (target: 'current' | 'draft', content?: WhatToAskContent) => void;
  /** The thread with the exchanges of the open conversation (or the new chat) merged in by time. */
  withExchanges: (messages: ChatMessage[]) => ChatMessage[];
  /** Call before sending: a new chat's exchanges then move into the dialog the send creates. */
  noteSend: () => void;
  /** Drop the new chat's exchanges (the user started over or left it). */
  clearDraft: () => void;
}

/** The key the new chat's exchanges are held under until it has a dialog. */
const DRAFT_KEY = '';

interface Exchange {
  id: string;
  at: number;
  content: WhatToAskContent;
}

/**
 * Local "What to ask?" exchanges, per conversation: never sent, never stored,
 * gone on reload. Each is a user message and an assistant message carrying a
 * `data-suggestions` part, built at render from the exchange's content. Picking a chip reaches
 * `ChatMessageActions.pickSuggestion`. A new chat holds its
 * own until a send gives it a dialog (they move there) or the user opens
 * another conversation (they are dropped).
 */
export function useWhatToAsk({ dialogId, content, user, assistant }: UseWhatToAskOptions): WhatToAsk {
  const [byDialog, setByDialog] = useState<Record<string, Exchange[]>>({});
  const [draftSent, setDraftSent] = useState(false);
  const key = dialogId ?? DRAFT_KEY;

  // A new chat that got its dialog: keep its exchanges there if a send made
  // it, drop them if another conversation was opened instead. Adjusted while
  // rendering, so the thread never shows a frame without them.
  const [prevKey, setPrevKey] = useState(key);
  if (prevKey !== key) {
    setPrevKey(key);
    if (prevKey === DRAFT_KEY) {
      setDraftSent(false);
      setByDialog(prev => {
        const { [DRAFT_KEY]: draft, ...rest } = prev;
        if (!draft) return prev;
        return draftSent ? { ...rest, [key]: [...(rest[key] ?? []), ...draft] } : rest;
      });
    }
  }

  const ask = useCallback(
    (target: 'current' | 'draft', override?: WhatToAskContent) => {
      const shown = override ?? content;
      if (!shown) return;
      const into = target === 'current' && dialogId ? dialogId : DRAFT_KEY;
      const exchange = {
        id: `what-to-ask-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        at: Date.now(),
        content: shown,
      };
      setByDialog(prev => ({ ...prev, [into]: [...(prev[into] ?? []), exchange] }));
    },
    [content, dialogId],
  );

  const noteSend = useCallback(() => {
    if (dialogId == null) setDraftSent(true);
  }, [dialogId]);

  const clearDraft = useCallback(() => {
    setDraftSent(false);
    setByDialog(prev => {
      if (!prev[DRAFT_KEY]) return prev;
      const rest = { ...prev };
      delete rest[DRAFT_KEY];
      return rest;
    });
  }, []);

  const exchanges = byDialog[key] ?? [];
  const withExchanges = (messages: ChatMessage[]): ChatMessage[] => {
    if (exchanges.length === 0) return messages;
    const local = exchanges.flatMap(exchange => exchangeMessages(exchange, user, assistant));
    return mergeByTime(messages, local);
  };

  return { ask, withExchanges, noteSend, clearDraft };
}

function exchangeMessages(
  { id, at, content }: Exchange,
  user: WhatToAskAuthor | undefined,
  assistant: WhatToAskAuthor | undefined,
): ChatMessage[] {
  return [
    {
      id: `${id}-question`,
      role: 'user',
      metadata: { createdAt: new Date(at).toISOString(), ...(user ? { author: user } : {}) },
      parts: [{ type: 'text', text: content.question }],
    },
    {
      id: `${id}-answer`,
      role: 'assistant',
      // A millisecond after the question, so the pair keeps its order.
      metadata: { createdAt: new Date(at + 1).toISOString(), ...(assistant ? { author: assistant } : {}) },
      parts: [
        { type: 'text', text: content.reply },
        {
          type: 'data-suggestions',
          data: { groups: content.groups, ...(content.note !== undefined ? { note: content.note } : {}) },
        },
      ],
    },
  ];
}

/**
 * Whether the thread waits on the user before it can go on: an approval or an
 * escalation offer nobody has answered. A "What to ask?" chip does not send
 * then: the conversation cannot take a message. A card of a tier the thread does
 * not draw waits on someone else.
 */
export function awaitsDecision(messages: readonly ChatMessage[], displayApprovalTypes?: readonly string[]): boolean {
  return messages.some(message =>
    message.parts.some(part => {
      if (part.type === 'data-escalation-offer') return part.data.status === 'pending';
      if (!isToolPart(part) || approvalStatusOf(part) !== 'pending') return false;
      const tier = 'approval' in part ? part.approval?.descriptor?.approvalType : undefined;
      return tier === undefined || approvalDisplaysInline(tier, displayApprovalTypes);
    }),
  );
}

function timeOf(message: ChatMessage): number | undefined {
  const createdAt = message.metadata?.createdAt;
  return createdAt === undefined ? undefined : Date.parse(createdAt);
}

/**
 * Places each local message before the first thread message that is later
 * than it, keeping the thread's own order. A thread message without a time
 * never moves anything past it.
 */
export function mergeByTime(thread: ChatMessage[], local: ChatMessage[]): ChatMessage[] {
  if (local.length === 0) return thread;
  const out: ChatMessage[] = [];
  let next = 0;
  for (const message of thread) {
    const at = timeOf(message);
    while (next < local.length && at !== undefined && (timeOf(local[next]) ?? 0) < at) {
      out.push(local[next]);
      next += 1;
    }
    out.push(message);
  }
  return out.concat(local.slice(next));
}

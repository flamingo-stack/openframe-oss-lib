'use client';

import { useCallback, useState } from 'react';
import type { AssistantType, AuthorType } from '../types/chat.types';
import type { Message, SuggestionGroup } from '../types/message.types';

/**
 * The "What to ask?" exchange: the question the user is shown asking, and the
 * assistant's answer, a line of text over grouped prompt chips.
 */
export interface WhatToAskContent {
  /** The user's side, e.g. "What can I ask you?". */
  question: string;
  /** The answer's text (markdown), above the chips. */
  reply: string;
  groups: SuggestionGroup[];
  /** A line under the chips, e.g. how picking one works. */
  note?: string;
}

/** Who a side of the exchange is shown as. */
export interface WhatToAskAuthor {
  name?: string;
  avatar?: string | null;
  authorType?: AuthorType;
  assistantType?: AssistantType;
}

export interface UseWhatToAskOptions {
  /** The open conversation; `null` for a new chat that has no dialog yet. */
  dialogId: string | null | undefined;
  /** What an exchange shows unless `ask` is handed its own. */
  content?: WhatToAskContent;
  user?: WhatToAskAuthor;
  assistant?: WhatToAskAuthor;
  /** Where a picked prompt goes (typically: sent). Absent: sent in the surrounding chat panel. */
  onPick?: (prompt: string) => void;
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
  withExchanges: (messages: Message[]) => Message[];
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
 * `suggestions` segment, built at render from the exchange's content. A new chat holds its
 * own until a send gives it a dialog (they move there) or the user opens
 * another conversation (they are dropped).
 */
export function useWhatToAsk({ dialogId, content, user, assistant, onPick }: UseWhatToAskOptions): WhatToAsk {
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
  const withExchanges = (messages: Message[]): Message[] => {
    if (exchanges.length === 0) return messages;
    const local = exchanges.flatMap(exchange => exchangeMessages(exchange, user, assistant, onPick));
    return mergeByTime(messages, local);
  };

  return { ask, withExchanges, noteSend, clearDraft };
}

function exchangeMessages(
  { id, at, content }: Exchange,
  user: WhatToAskAuthor | undefined,
  assistant: WhatToAskAuthor | undefined,
  onPick: ((prompt: string) => void) | undefined,
): Message[] {
  return [
    {
      id: `${id}-question`,
      role: 'user',
      content: content.question,
      timestamp: new Date(at),
      name: user?.name,
      avatar: user?.avatar,
      authorType: user?.authorType,
    },
    {
      id: `${id}-answer`,
      role: 'assistant',
      content: [
        { type: 'text', text: content.reply },
        { type: 'suggestions', groups: content.groups, note: content.note, onPick },
      ],
      // A millisecond after the question, so the pair keeps its order.
      timestamp: new Date(at + 1),
      name: assistant?.name,
      avatar: assistant?.avatar,
      authorType: assistant?.authorType,
      assistantType: assistant?.assistantType,
    },
  ];
}

/**
 * Whether the thread waits on the user before it can go on: an approval or an
 * escalation offer nobody has answered. A "What to ask?" chip does not send
 * then: the conversation cannot take a message.
 */
export function awaitsDecision(messages: readonly Message[]): boolean {
  return messages.some(
    message =>
      Array.isArray(message.content) &&
      message.content.some(
        segment =>
          (segment.type === 'approval_request' ||
            segment.type === 'approval_batch' ||
            segment.type === 'escalation_offer') &&
          (segment.status ?? 'pending') === 'pending',
      ),
  );
}

/**
 * Places each local message before the first thread message that is later
 * than it, keeping the thread's own order. A thread message without a time
 * never moves anything past it.
 */
export function mergeByTime(thread: Message[], local: Message[]): Message[] {
  if (local.length === 0) return thread;
  const out: Message[] = [];
  let next = 0;
  for (const message of thread) {
    const at = message.timestamp?.getTime();
    while (next < local.length && at !== undefined && (local[next].timestamp?.getTime() ?? 0) < at) {
      out.push(local[next]);
      next += 1;
    }
    out.push(message);
  }
  return out.concat(local.slice(next));
}

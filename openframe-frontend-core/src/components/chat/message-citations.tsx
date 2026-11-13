'use client';

/**
 * A message's sources and citation numbers, in a per-message context: what its citation chips, its record chips and
 * its cards read to know where a record lives (the message's own source part) and which number a source carries.
 *
 * A context, because the message's `<a>` override is not rebuilt per token: its identity is what the markdown engine's
 * block memoization holds on (`chat-message-enhanced.tsx`). Its own module so the card dispatch and the chips read it
 * without importing each other.
 */

import { createContext, useContext, useMemo } from 'react';
import type { ChatPart, ChatSourcePart } from '../../chat-protocol/chat-message';
import { citationNumbers } from '../../chat-protocol/citations';
import { normalizeSourceId, recordHref } from '../../chat-protocol/record-link';
import { useStableShallow, useStableSources } from './hooks/use-stable-shallow';

export interface MessageCitations {
  sources: readonly ChatSourcePart[];
  /** Each cited source's number, by source id. */
  numbers: ReadonlyMap<string, number>;
}

const MessageCitationsContext = createContext<MessageCitations | null>(null);

export const MessageCitationsProvider = MessageCitationsContext.Provider;

/** A message's sources and numbers, keeping their identities across deltas that change neither. */
export function useMessageCitations(parts: readonly ChatPart[]): MessageCitations {
  const sources = useStableSources(parts);
  const byId = useStableShallow(Object.fromEntries(citationNumbers(parts)));
  return useMemo(() => ({ sources, numbers: new Map(Object.entries(byId)) }), [sources, byId]);
}

/** The source part of the message a record link sits in, when the message has one. */
export function useMessageSourceOf(type: string, id: string): ChatSourcePart | null {
  const sources = useContext(MessageCitationsContext)?.sources;
  const uri = recordHref(type, id);
  return sources?.find(source => normalizeSourceId(source.sourceId) === uri) ?? null;
}

/** The source the message numbers `number`, or null. */
export function useMessageSourceOfNumber(number: number): ChatSourcePart | null {
  const citations = useContext(MessageCitationsContext);
  if (!citations) return null;
  for (const [id, n] of citations.numbers) {
    if (n === number) return citations.sources.find(source => source.sourceId === id) ?? null;
  }
  return null;
}

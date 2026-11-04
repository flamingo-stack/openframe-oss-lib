'use client';

/**
 * The numbered chip a citation draws in an answer's text (`[3]`). `textWithCitationChips` writes it into a render-only
 * copy of the markdown as a link (`[3](#citation-3)`), and the message's `<a>` override draws this.
 *
 * It reads the message's sources and numbers from a per-message context, because the override is not rebuilt per token:
 * its identity is what the markdown engine's block memoization holds on (`chat-message-enhanced.tsx`). It opens its
 * source where the strip's chip does (`resolveSourceRowCTA`, `NavLinkAnchorViaRuntime`). A source with no url, or a chat
 * with no runtime (nothing to route through), draws a plain `[3]`.
 */

import { createContext, useContext, useMemo } from 'react';
import type { ChatPart, ChatSourcePart } from '../../chat-protocol/chat-message';
import { citationNumbers } from '../../chat-protocol/citations';
import { normalizeSourceId, recordHref } from '../../chat-protocol/record-link';
import { useChatRuntime } from '../../contexts/chat-runtime-context';
import { useStableShallow, useStableSources } from './hooks/use-stable-shallow';
import { NavLinkAnchorViaRuntime } from './nav-link-anchor-via-runtime';
import { sourceRowInputOf, sourceTitleOf } from './utils/cited-sources';
import { resolveSourceRowCTA, sourceRowCtxFromRuntime } from './utils/source-row-cta';

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

const CHIP_CLASS = 'text-ods-text-secondary no-underline text-h6 hover:text-ods-text-primary';

function sourceOfNumber(citations: MessageCitations | null, number: number): ChatSourcePart | null {
  if (!citations) return null;
  for (const [id, n] of citations.numbers) {
    if (n === number) return citations.sources.find(source => source.sourceId === id) ?? null;
  }
  return null;
}

export function CitationChip({ number }: { number: number }) {
  const source = sourceOfNumber(useContext(MessageCitationsContext), number);
  const runtime = useChatRuntime();
  const label = `[${number}]`;
  if (!source || !runtime) return <span className="text-ods-text-secondary text-h6">{label}</span>;
  const cta = resolveSourceRowCTA(sourceRowInputOf(source), sourceRowCtxFromRuntime(runtime));
  if (!cta.href) return <span className="text-ods-text-secondary text-h6">{label}</span>;
  return (
    <NavLinkAnchorViaRuntime
      href={cta.href}
      targetPlatform={cta.targetPlatform}
      className={CHIP_CLASS}
      title={sourceTitleOf(source)}
    >
      {label}
    </NavLinkAnchorViaRuntime>
  );
}

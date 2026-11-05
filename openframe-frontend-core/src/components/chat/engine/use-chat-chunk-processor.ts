'use client';

/**
 * useChatChunkProcessor: a raw NATS chunk, through the key's ONE decoder, into its thread, for every NATS chat (the lib's
 * engine, OpenFrame Mingo and tickets, the Fae client).
 *
 * `createMingoDecoder` says what a chunk means, the reducer what it does to the thread. What is here is the wiring around
 * them: the persisted approval statuses a replayed card consults, the re-seed of a key whose reducer was evicted, what a
 * host reads from a chunk beside the thread (`observers`), and the two rules about direct messages a chat with a person
 * in it needs (`ownDirectOwnerType`, `otherDisplayName`).
 *
 * The returned function is identity-stable: hosts hand it to a long-lived subscription.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { ChatMessage, ChatTicketEventData } from '../../../chat-protocol/chat-message';
import {
  approvalStatusOfResponse,
  isOwnRowGrant,
  type ChatStreamEntry,
  type UiChunk,
} from '../../../chat-protocol/ui-chunks';
import type { ChatApprovalStatus } from '../types';
import type { BoundChatThread } from './chat-thread-store';

/** What a chunk tells a host beside the thread, the thread being the reducer's. */
export interface ChatChunkObservers {
  onTokenUsage?: (data: Extract<UiChunk, { type: 'data-token-usage' }>['data']) => void;
  onDialogClosed?: () => void;
  onTicketEvent?: (event: ChatTicketEventData) => void;
  /** A direct message that is not the viewer's own: a person is in the chat. */
  onOtherDirectMessage?: () => void;
  /** The viewer's own direct message came back (`ownDirectOwnerType`), with its stream sequence. */
  onOwnDirectEcho?: (streamSeq: number | undefined) => void;
  onOfferResolved?: (offerId: string, status: ChatApprovalStatus) => void;
  /** An approval answered, by anyone. A tool's grant of its own row is no answer. */
  onApprovalResolved?: (id: string, status: ChatApprovalStatus, resolvedByName?: string | null) => void;
  onError?: () => void;
}

/** The direct-message rules of a chat a person can write into. */
export interface ChatDirectMessageRules {
  /** The owner type the viewer's own direct message comes back as: it draws no row (the optimistic one shows it). */
  ownDirectOwnerType?: string;
  /**
   * The signed-in viewer, when people of the same owner type write into one chat (two technicians are both ADMIN): a
   * direct message that names another author is theirs, and draws its row. One that names no author is the viewer's.
   * A thunk, read on every chunk.
   */
  ownUserId?: () => string | undefined;
  /** What a direct message naming nobody is shown as. */
  otherDisplayName?: string;
}

function isOwnDirectEcho(chunk: UiChunk, rules: ChatDirectMessageRules): boolean {
  if (
    rules.ownDirectOwnerType === undefined ||
    chunk.type !== 'data-chat-participant' ||
    chunk.data.kind !== 'direct-message' ||
    chunk.data.ownerType !== rules.ownDirectOwnerType
  ) {
    return false;
  }
  const author = chunk.data.userId;
  const own = rules.ownUserId?.();
  return !author || own === undefined || author === own;
}

function withOtherName(chunk: UiChunk, rules: ChatDirectMessageRules): UiChunk {
  if (
    rules.otherDisplayName === undefined ||
    chunk.type !== 'data-chat-participant' ||
    chunk.data.kind !== 'direct-message' ||
    chunk.data.displayName
  ) {
    return chunk;
  }
  return { ...chunk, data: { ...chunk.data, displayName: rules.otherDisplayName } };
}

/** The entry the thread gets: the viewer's own echo left out, a nameless direct message named. */
export function threadEntryOf(entry: ChatStreamEntry, rules: ChatDirectMessageRules): ChatStreamEntry {
  if (rules.ownDirectOwnerType === undefined && rules.otherDisplayName === undefined) return entry;
  const chunks = entry.chunks.filter(chunk => !isOwnDirectEcho(chunk, rules)).map(chunk => withOtherName(chunk, rules));
  return { ...entry, chunks };
}

/** Tell the observers what an entry says beside the thread. */
export function observeChatEntry(
  entry: ChatStreamEntry,
  observers: ChatChunkObservers,
  rules: ChatDirectMessageRules = {},
): void {
  for (const chunk of entry.chunks) {
    switch (chunk.type) {
      case 'data-token-usage':
        observers.onTokenUsage?.(chunk.data);
        break;
      case 'data-dialog-closed':
        observers.onDialogClosed?.();
        break;
      case 'data-ticket-event':
        observers.onTicketEvent?.(chunk.data);
        break;
      case 'data-chat-participant':
        if (isOwnDirectEcho(chunk, rules)) observers.onOwnDirectEcho?.(entry.seq);
        else if (chunk.data.kind === 'direct-message') observers.onOtherDirectMessage?.();
        break;
      case 'data-escalation-offer':
        if (chunk.data.status !== 'pending' && chunk.id) observers.onOfferResolved?.(chunk.id, chunk.data.status);
        break;
      case 'tool-approval-response':
        if (!isOwnRowGrant(chunk, entry)) {
          observers.onApprovalResolved?.(
            chunk.approvalId,
            approvalStatusOfResponse(chunk),
            chunk.toolMetadata?.resolvedByName ?? undefined,
          );
        }
        break;
      case 'data-error':
        observers.onError?.();
        break;
      default:
        break;
    }
  }
}

export interface UseChatChunkProcessorOptions extends ChatDirectMessageRules {
  /** The key's handle (`store.bind(key)`). */
  thread: BoundChatThread;
  /** The key's thread as the host holds it: what a REPLACEMENT reducer is re-seeded from after an eviction. */
  messages?: readonly ChatMessage[];
  /** Persisted approval statuses, which a replayed approval card consults. */
  approvalStatuses?: Record<string, string>;
  observers?: ChatChunkObservers;
  /** Log what each chunk became (and, for an approval, the parts it left). Read on every chunk. */
  debug?: () => boolean;
}

export function useChatChunkProcessor({
  thread,
  messages,
  approvalStatuses,
  observers,
  ownDirectOwnerType,
  ownUserId,
  otherDisplayName,
  debug,
}: UseChatChunkProcessorOptions): (chunk: unknown) => void {
  // Latest-value refs, written after the commit: every reader runs in a subscription callback.
  const rules = { ownDirectOwnerType, ownUserId, otherDisplayName };
  const latest = useRef({ thread, observers, rules, debug });
  useEffect(() => {
    latest.current = { thread, observers, rules, debug };
  });

  // Both effects below write into a specific reducer INSTANCE, and an eviction replaces it behind an unchanged key. The
  // epoch moves on every eviction, and re-arms both.
  const { evictionEpoch } = thread;

  // evictionEpoch is the re-arm trigger, not read in the body.
  useEffect(() => {
    if (approvalStatuses && Object.keys(approvalStatuses).length > 0) thread.mergeApprovalStatuses(approvalStatuses);
  }, [approvalStatuses, thread, evictionEpoch]);

  // The re-seed after an eviction, the one seeding this hook owns (ordinary hydration is `hydrate`'s). The parked state
  // restores the thread, statuses, cursor and echoes, but not an unfinished turn's busy phase. No replay follows, so
  // adoption is not armed.
  const seededEpochRef = useRef(evictionEpoch);
  useEffect(() => {
    if (seededEpochRef.current === evictionEpoch) return;
    seededEpochRef.current = evictionEpoch;
    if (!messages || messages.length === 0) return;
    thread.hydrate(messages, { expectingReplay: false });
  }, [messages, thread, evictionEpoch]);

  return useCallback((chunk: unknown) => {
    const { thread: bound, observers: observe, rules: entryRules, debug: debugOn } = latest.current;
    const entry = bound.decode(chunk);
    const logging = debugOn?.() ?? false;
    if (logging) {
      const type = (chunk as { type?: unknown } | null)?.type;
      const became = entry.chunks.length > 0 ? entry.chunks.map(c => c.type).join(', ') : 'DROPPED';
      console.log(`[chat-chunk] ${String(type)} → ${became}`, { chunk, entry });
    }
    if (entry.chunks.length === 0) return;

    bound.apply(threadEntryOf(entry, entryRules));
    if (observe) observeChatEntry(entry, observe, entryRules);

    if (logging && entry.chunks.some(decoded => decoded.type === 'tool-approval-request')) {
      bound.mutate(reducer => {
        const { messages: drawn } = reducer.state;
        const last = drawn[drawn.length - 1];
        console.log(`[chat-chunk] after apply → parts: ${JSON.stringify((last?.parts ?? []).map(p => p.type))}`);
      });
    }
  }, []);
}

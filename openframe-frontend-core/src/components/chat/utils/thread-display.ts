/**
 * The thread as a chat draws it, and the questions every chat asks of it: which card is still waiting, on whom, and who
 * wrote a row. ONE module for every web chat (the hubs, OpenFrame Mingo and tickets, the Fae client), so a rule is
 * written once instead of once per app.
 *
 * What a chunk does to the thread is the reducer's (`../stream/chat-stream-reducer`); whether the tail is unfinished is
 * `extract-incomplete-message-state`. This is what is left: dedupe, the pending gates and authorship.
 */

import {
  approvalIdOfPart,
  approvalStatusOf,
  isToolPart,
  type ChatMessage,
  type ChatPart,
} from '../../../chat-protocol/chat-message';
import { approvalDisplaysInline } from './approval-display';

/** The tier a tool part's card is answered by, where its transport names one. */
function approvalTierOf(part: ChatPart): string | undefined {
  return isToolPart(part) && 'approval' in part ? part.approval?.descriptor?.approvalType : undefined;
}

/** The id a card is answered by, while it is pending: the batch's when it has one. */
export function pendingApprovalIdOf(part: ChatPart): string | undefined {
  if (!isToolPart(part) || approvalStatusOf(part) !== 'pending') return undefined;
  return approvalIdOfPart(part);
}

/** An escalation offer nobody has answered. An offer is SUPERSEDED by a new message, not rejected. */
export function pendingOfferIdOf(part: ChatPart): string | undefined {
  return part.type === 'data-escalation-offer' && part.data.status === 'pending' ? part.id : undefined;
}

/**
 * The most recent unresolved gate, newest message and part first. Approvals and escalation offers are asked about
 * SEPARATELY (`pendingApprovalIdOf`, `pendingOfferIdOf`): a thread can hold one of each, and both settle when the user
 * interrupts with a message.
 */
export function findLatestPendingId(
  messages: readonly ChatMessage[],
  pickId: (part: ChatPart) => string | undefined,
): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const { parts } = messages[i];
    for (let j = parts.length - 1; j >= 0; j--) {
      const id = pickId(parts[j]);
      if (id) return id;
    }
  }
  return undefined;
}

/**
 * Whether the thread waits on the user before it can go on: an approval or an escalation offer nobody has answered. A
 * card of a tier the thread does not draw waits on someone else (`awaitsOtherTier`).
 */
export function awaitsDecision(messages: readonly ChatMessage[], displayApprovalTypes?: readonly string[]): boolean {
  return messages.some(message =>
    message.parts.some(part => {
      if (part.type === 'data-escalation-offer') return part.data.status === 'pending';
      if (!isToolPart(part) || approvalStatusOf(part) !== 'pending') return false;
      const tier = approvalTierOf(part);
      return tier === undefined || approvalDisplaysInline(tier, displayApprovalTypes);
    }),
  );
}

/** A pending card of a tier this chat does not answer: someone else (a technician, an admin) decides it. */
export function awaitsOtherTier(messages: readonly ChatMessage[], displayApprovalTypes: readonly string[]): boolean {
  return messages.some(message =>
    message.parts.some(part => {
      if (!isToolPart(part) || approvalStatusOf(part) !== 'pending') return false;
      const tier = approvalTierOf(part);
      return tier !== undefined && !approvalDisplaysInline(tier, displayApprovalTypes);
    }),
  );
}

/**
 * Identity used to drop a block drawn twice (a history page and the live copy). A batch is one card of several parts, so
 * its rows share the batch's id. `data-ticket-escalated` is deliberately absent: its only id is the dialog-scoped ticket
 * id, so a dialog escalated more than once would have its second receipt swallowed.
 */
function dedupeId(part: ChatPart): string | undefined {
  if (isToolPart(part)) return approvalIdOfPart(part);
  return part.type === 'data-escalation-offer' ? part.id : undefined;
}

function isAnswered(part: ChatPart): boolean {
  if (isToolPart(part)) {
    const status = approvalStatusOf(part);
    return status !== null && status !== 'pending';
  }
  return part.type === 'data-escalation-offer' && part.data.status !== 'pending';
}

/**
 * The thread as a view draws it: an id-bearing block in one bubble (first occurrence wins, an agent retry reuses the
 * id; an answer lands on the newest copy only, so a copy still pending never stands in for one that was answered), and
 * no assistant bubble left holding nothing. `keepPart` is the view's own filter. A message nothing changed is returned
 * as it was, so the per-message memo holds.
 */
export function threadForDisplay<M extends ChatMessage>(
  messages: readonly M[],
  keepPart: (part: ChatPart) => boolean = () => true,
): M[] {
  const answeredIn = new Map<string, M>();
  for (const message of messages) {
    for (const part of message.parts) {
      const id = dedupeId(part);
      if (id && !answeredIn.has(id) && isAnswered(part) && keepPart(part)) answeredIn.set(id, message);
    }
  }

  const holderOf = new Map<string, M>();
  const out: M[] = [];
  for (const message of messages) {
    const parts = message.parts.filter(part => {
      if (!keepPart(part)) return false;
      const id = dedupeId(part);
      if (!id) return true;
      const answered = answeredIn.get(id);
      if (answered && answered !== message) return false;
      const holder = holderOf.get(id);
      if (holder && holder !== message) return false;
      holderOf.set(id, message);
      return true;
    });
    if (message.role === 'assistant' && parts.length === 0) continue;
    out.push(parts.length === message.parts.length ? message : { ...message, parts });
  }
  return out;
}

/** The names a row with no author of its own is given: the viewer's own, and another person's (a technician). */
export interface ThreadAuthorNames {
  own: string;
  other: string;
}

/**
 * The reducer writes no author on a row it makes, and a persisted row names its own. What is left is the chat's voice:
 * its assistant's name and face, the viewer's name on their own send, and another person who has no name of their own.
 */
export function withThreadAuthor(
  message: ChatMessage,
  assistant: { name: string | undefined; avatar: string | undefined },
  names: ThreadAuthorNames,
): ChatMessage {
  const { author } = message.metadata ?? {};
  if (author?.name || message.role === 'system') return message;
  if (message.role === 'assistant') {
    const named = { ...author, name: assistant.name, avatar: assistant.avatar };
    return { ...message, metadata: { ...message.metadata, author: named } };
  }
  const name = author?.authorType === 'admin' ? names.other : names.own;
  return { ...message, metadata: { ...message.metadata, author: { ...author, name } } };
}

/** What an unread counter counts, as the backend does: an answer and another person's reply, never a failed send. */
export function isForeignReply(message: ChatMessage): boolean {
  if (message.role === 'user') return message.metadata?.author?.authorType === 'admin';
  return message.role === 'assistant' && message.parts.some(part => part.type !== 'data-error');
}

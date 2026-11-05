/**
 * Persisted Mingo rows (GraphQL `HistoricalMessage`) as the thread they draw.
 *
 * What an entry of a row SAYS is `createMingoDecoder`'s, the decoder a live chunk goes through, and what its chunks do is
 * `applyChunkToMessages`, so a reloaded answer reads as the one the reader watched arrive. What is here is the envelope a
 * chunk does not carry: which rows make one turn (user/assistant flush-grouping), who wrote them (OWNER_TYPE author,
 * display name, avatar), a user row's attached context, a standalone SYSTEM row, and the turn's highest persisted
 * sequence.
 *
 * An offer and its resolution, or an approval card and its result, can sit in different turns: a user message always
 * separates an offer from the resolution that message caused. The list rule finds the card wherever it is.
 */

import { applyChunkToMessages, createWireState } from '../../../chat-protocol/apply-chunk';
import { isSourcePart, type ChatMessage } from '../../../chat-protocol/chat-message';
import { createMingoDecoder } from '../../../chat-protocol/message-decoder';
import type { UiChunk } from '../../../chat-protocol/ui-chunks';
import { isAnsweredStatus, knownApprovalAnswer, resolutionChunks } from '../stream/message-mutations';
import {
  MESSAGE_TYPE,
  OWNER_TYPE,
  type AuthorType,
  type HistoricalMessage,
  type MessageProcessingOptions,
  type MessageData,
  type MessageOwner,
} from '../types';

function getOwnerDisplayName(owner?: MessageOwner): string {
  if (owner?.type === OWNER_TYPE.ADMIN && owner.user) {
    const { firstName, lastName } = owner.user;
    const name = [firstName, lastName].filter(Boolean).join(' ');
    if (name) return name;
  }
  return owner?.type === OWNER_TYPE.ADMIN ? 'Admin' : 'You';
}

/** Per-message author avatar (e.g. an admin's profile photo) when the owner
 *  carries one. `imageUrl` may be relative; the host resolves it downstream. */
function getOwnerAvatar(owner?: MessageOwner): string | undefined {
  return owner?.user?.image?.imageUrl ?? undefined;
}

function entriesOf(row: HistoricalMessage): MessageData[] {
  return row.parts ?? [];
}

function isUserRow(row: HistoricalMessage | undefined): boolean {
  return row?.owner?.type === OWNER_TYPE.CLIENT || row?.owner?.type === OWNER_TYPE.ADMIN;
}

function isoOf(createdAt: string): string {
  const time = Date.parse(createdAt);
  return Number.isNaN(time) ? createdAt : new Date(time).toISOString();
}

/** `TextData.contextItems` (server: `[{ type, id }]`), with no label on the wire: the id stands in, as on the live path. */
function contextItemsOf(data: MessageData): Array<{ type: string; id: string; label: string }> {
  const raw = (data as { contextItems?: Array<{ type?: unknown; id?: unknown }> }).contextItems;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(item => typeof item?.type === 'string' && typeof item?.id === 'string')
    .map(item => ({ type: item.type as string, id: item.id as string, label: item.id as string }));
}

/** Result type for historical message processing */
export interface ProcessHistoricalMessagesResult {
  messages: ChatMessage[];
}

/** Process an array of historical messages into the thread they draw. */
export function processHistoricalMessages(
  rows: HistoricalMessage[],
  options: MessageProcessingOptions = {},
): ProcessHistoricalMessagesResult {
  const {
    assistantName = 'Fae',
    assistantType = 'fae',
    assistantAvatar,
    chatTypeFilter,
    approvalStatuses = {},
    escalationOfferStates = {},
  } = options;

  const decoder = createMingoDecoder();
  const wire = createWireState();
  let messages: ChatMessage[] = [];
  /** The assistant turn being read: its message, and the id of the last row it took. */
  let turnId: string | null = null;
  let lastRowId: string | null = null;

  const applyChunks = (chunks: readonly UiChunk[]): void => {
    for (const chunk of chunks) messages = applyChunkToMessages(messages, chunk, wire);
  };

  /**
   * Ends the turn. A turn that has nothing to draw (its only rows were metadata, or tool results for a card further up)
   * leaves no message. The message takes the LAST row's id, for a React key stable across page boundaries.
   */
  const flushTurn = (): void => {
    if (turnId === null) return;
    const index = messages.findIndex(message => message.id === turnId);
    if (index !== -1) {
      const message = messages[index];
      messages = messages.slice();
      if (message.parts.every(isSourcePart)) messages.splice(index, 1);
      else messages[index] = { ...message, id: lastRowId ?? message.id };
    }
    turnId = null;
    lastRowId = null;
    wire.setMessageId(null);
    wire.textOffsets.clear();
  };

  const openTurn = (row: HistoricalMessage): void => {
    if (turnId === null) {
      turnId = row.id;
      messages = [
        ...messages,
        {
          id: row.id,
          role: 'assistant',
          metadata: {
            createdAt: isoOf(row.createdAt),
            author: {
              name: assistantName,
              authorType: assistantType,
              assistantType,
              ...(assistantAvatar !== undefined ? { avatar: assistantAvatar } : {}),
            },
          },
          parts: [],
        },
      ];
      wire.setMessageId(row.id);
    }
    lastRowId = row.id;
    // The model the turn ran on, as its row names it: what a chat's badge reads after a reload.
    const { model, modelName, providerName } = row.owner ?? {};
    if (row.owner?.type === OWNER_TYPE.ASSISTANT && model && providerName) {
      messages = messages.map(message =>
        message.id !== turnId
          ? message
          : {
              ...message,
              metadata: { ...message.metadata, model, modelLabel: modelName || model, provider: providerName },
            },
      );
    }
    if (typeof row.lastChunkStreamSeq === 'number') {
      const seq = row.lastChunkStreamSeq;
      messages = messages.map(message => {
        if (message.id !== turnId) return message;
        const current = message.metadata?.streamSeq;
        return current !== undefined && current >= seq
          ? message
          : { ...message, metadata: { ...message.metadata, streamSeq: seq } };
      });
    }
  };

  rows.forEach((row, index) => {
    if (chatTypeFilter && row.chatType !== chatTypeFilter) return;
    const entries = entriesOf(row);

    if (entries.some(data => data.type === MESSAGE_TYPE.SYSTEM)) {
      flushTurn();
      for (const data of entries) {
        if (data.type === MESSAGE_TYPE.SYSTEM && data.text) {
          messages = [
            ...messages,
            {
              id: row.id,
              role: 'system',
              metadata: {
                createdAt: isoOf(row.createdAt),
                author: { authorType: 'system' },
                ...(typeof row.lastChunkStreamSeq === 'number' ? { streamSeq: row.lastChunkStreamSeq } : {}),
              },
              parts: [{ type: 'text', text: data.text }],
            },
          ];
        }
      }
      return;
    }

    if (isUserRow(row)) {
      flushTurn();
      const authorType: AuthorType = row.owner?.type === OWNER_TYPE.ADMIN ? 'admin' : 'user';
      for (const data of entries) {
        if (data.type !== MESSAGE_TYPE.TEXT || !data.text) continue;
        const contextItems = contextItemsOf(data);
        const avatar = getOwnerAvatar(row.owner);
        messages = [
          ...messages,
          {
            id: row.id,
            role: 'user',
            metadata: {
              createdAt: isoOf(row.createdAt),
              author: { name: getOwnerDisplayName(row.owner), authorType, ...(avatar !== undefined ? { avatar } : {}) },
              ...(contextItems.length > 0 ? { contextItems } : {}),
              ...(typeof row.lastChunkStreamSeq === 'number' ? { streamSeq: row.lastChunkStreamSeq } : {}),
            },
            parts: [{ type: 'text', text: data.text }],
          },
        ];
      }
      return;
    }

    openTurn(row);
    const createdAt = isoOf(row.createdAt);
    for (const data of entries) {
      // A TICKET_EVENT is standalone, one per row, so the row's seq IS the event's identity, the only join between this
      // row and a catch-up replay of the same chunk. But vouch for that only when the row holds exactly one entry: a
      // bundled row's `lastChunkStreamSeq` belongs to its LAST chunk and could stamp the wrong event.
      const seq =
        entries.length === 1 && typeof row.lastChunkStreamSeq === 'number' ? row.lastChunkStreamSeq : undefined;
      const { chunks } = decoder.decode(data, { row: { createdAt, ...(seq !== undefined ? { seq } : {}) } });
      for (const chunk of chunks) {
        // A row holds no turn boundary of its own: the rows around it say where its turn ends.
        if (chunk.type === 'start' || chunk.type === 'finish' || chunk.type === 'abort') continue;
        // A status known from elsewhere overrules what the row says, and the row still says who gave the answer.
        if (chunk.type === 'tool-approval-response' && isAnsweredStatus(approvalStatuses[chunk.approvalId])) {
          const name = chunk.toolMetadata?.resolvedByName;
          applyChunks(resolutionChunks(chunk.approvalId, approvalStatuses[chunk.approvalId], name));
          continue;
        }
        if (chunk.type === 'tool-output-denied' && isAnsweredStatus(approvalStatuses[chunk.toolCallId])) continue;
        if (chunk.type === 'data-escalation-offer' && chunk.data.status === 'pending') {
          const known = escalationOfferStates[chunk.id];
          applyChunks([known !== undefined ? { ...chunk, data: { ...chunk.data, status: known } } : chunk]);
          continue;
        }
        applyChunks([chunk]);
      }
      // The resolution may be known to the consumer while its APPROVAL_RESULT row is not on the fetched pages. After the
      // whole entry, so the rows of its batch that ask nothing are there to take it.
      for (const chunk of chunks) {
        if (chunk.type !== 'tool-approval-request') continue;
        const known = knownApprovalAnswer(approvalStatuses, chunk);
        if (known) applyChunks(resolutionChunks(known.id, known.status));
      }
    }

    // The next row is the user's, or there is none: this turn is complete.
    if (index === rows.length - 1 || isUserRow(rows[index + 1])) flushTurn();
  });

  flushTurn();

  return { messages };
}

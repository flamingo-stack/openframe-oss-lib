/**
 * A message with OpenFrame files, through every path that draws it: the optimistic bubble, its live echo, someone
 * else's live message, the history, and the merge of a reloaded history with what the thread already shows. A message
 * of files alone has no text and must still draw, once.
 */

import { describe, expect, it, vi } from 'vitest';
import type { OpenFrameMessageAttachment } from '../../../../chat-protocol/attachment-profiles';
import type { ChatMessage } from '../../../../chat-protocol/chat-message';
import { createMingoDecoder } from '../../../../chat-protocol/message-decoder';
import { MINGO_MESSAGES_QUERY } from '../../../../chat-protocol/mingo-graphql';
import { createMingoGraphqlHistory, type MingoGraphqlPost } from '../../engine/mingo-graphql-history';
import type { HistoricalMessage } from '../../types/message.types';
import { mergeHistoryWithRealtime } from '../../utils/history-merge';
import { openFrameSentAttachmentOf } from '../../utils/openframe-attachment-tray';
import { processHistoricalMessages } from '../../utils/process-historical-messages';
import { createChatStreamReducer } from '../chat-stream-reducer';

const LOG: OpenFrameMessageAttachment = { id: 'att_1', name: 'disk.log', mediaType: 'text/plain', size: 2048 };
const SHOT: OpenFrameMessageAttachment = { id: 'att_2', name: 'shot.png', mediaType: 'image/png', size: 900 };
const wire = (file: OpenFrameMessageAttachment) => ({
  id: file.id,
  fileName: file.name,
  contentType: file.mediaType,
  fileSize: file.size,
  estimatedTokens: 10,
});

const userRows = (messages: readonly ChatMessage[]) => messages.filter(message => message.role === 'user');

function onWire() {
  const r = createChatStreamReducer();
  const decoder = createMingoDecoder();
  const send = (raw: unknown) => r.apply(decoder.decode(raw));
  return { r, send };
}

describe('the optimistic bubble', () => {
  it('draws a send of files alone, with the files and no empty text', () => {
    const { r } = onWire();
    r.pushOptimisticSend('', false, [LOG, SHOT]);
    const [row] = userRows(r.state.messages);
    expect(row.parts).toEqual([]);
    expect(row.metadata?.openframeAttachments).toEqual([LOG, SHOT]);
    expect(r.state.streamingPhase).toBe('thinking');
  });

  it('puts the files on a text send, and still draws nothing for an empty send without files', () => {
    const { r } = onWire();
    r.pushOptimisticSend('see attached', false, [LOG]);
    r.pushOptimisticSend('');
    const rows = userRows(r.state.messages);
    expect(rows).toHaveLength(1);
    expect(rows[0].parts).toEqual([{ type: 'text', text: 'see attached' }]);
    expect(rows[0].metadata?.openframeAttachments).toEqual([LOG]);
  });

  it('is not drawn twice when its echo comes back with the files', () => {
    const { r, send } = onWire();
    r.pushOptimisticSend('', false, [LOG]);
    send({ type: 'MESSAGE_REQUEST', ownerType: 'CLIENT', attachments: [wire(LOG)] });
    expect(userRows(r.state.messages)).toHaveLength(1);
  });
});

describe('a live message from someone else', () => {
  it("draws a person's files alone as their own row", () => {
    const { r, send } = onWire();
    send({ type: 'MESSAGE_REQUEST', ownerType: 'CLIENT', streamSeq: 4, attachments: [wire(SHOT)] });
    const [row] = userRows(r.state.messages);
    expect(row.parts).toEqual([]);
    expect(row.metadata?.openframeAttachments).toEqual([SHOT]);
    expect(row.metadata?.streamSeq).toBe(4);
  });

  it("draws a technician's direct message with its files", () => {
    const { r, send } = onWire();
    send({
      type: 'DIRECT_MESSAGE',
      ownerType: 'ADMIN',
      displayName: 'Dana',
      text: 'try this',
      attachments: [wire(LOG)],
    });
    const [row] = userRows(r.state.messages);
    expect(row.metadata?.author).toEqual({ name: 'Dana', authorType: 'admin' });
    expect(row.parts).toEqual([{ type: 'text', text: 'try this' }]);
    expect(row.metadata?.openframeAttachments).toEqual([LOG]);
  });

  it('keeps two seq-less messages of the same text with different files', () => {
    const { r, send } = onWire();
    send({ type: 'MESSAGE_REQUEST', ownerType: 'CLIENT', text: 'here', attachments: [wire(LOG)] });
    send({ type: 'MESSAGE_REQUEST', ownerType: 'CLIENT', text: 'here', attachments: [wire(SHOT)] });
    send({ type: 'MESSAGE_REQUEST', ownerType: 'CLIENT', text: 'here', attachments: [wire(SHOT)] });
    expect(userRows(r.state.messages).map(row => row.metadata?.openframeAttachments?.[0].id)).toEqual([
      'att_1',
      'att_2',
    ]);
  });
});

describe('the history', () => {
  const row = (extra: Partial<HistoricalMessage>): HistoricalMessage => ({
    id: 'm1',
    chatType: 'ADMIN_AI_CHAT',
    createdAt: '2026-11-27T10:00:00Z',
    owner: { type: 'ADMIN' },
    ...extra,
  });

  it('draws a message of files alone with its files', () => {
    const { messages } = processHistoricalMessages([row({ parts: [], attachments: [wire(LOG), wire(SHOT)] })]);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].metadata?.openframeAttachments).toEqual([LOG, SHOT]);
  });

  it('puts the files on the text they came with, and nothing on a row without', () => {
    const { messages } = processHistoricalMessages([
      row({ parts: [{ type: 'TEXT', text: 'see attached' }], attachments: [wire(LOG)] }),
      row({ id: 'm2', parts: [{ type: 'TEXT', text: 'and this' }] }),
    ]);
    expect(messages.map(message => message.metadata?.openframeAttachments)).toEqual([[LOG], undefined]);
  });
});

describe('a reloaded history', () => {
  const at = (ms: number) => new Date(ms).toISOString();
  const persisted: ChatMessage = {
    id: 'aaaa0001',
    role: 'user',
    metadata: { createdAt: at(2000), openframeAttachments: [LOG] },
    parts: [{ type: 'text', text: '' }],
  };

  it('replaces the bubble of a send of files alone with its persisted row, once', () => {
    const bubble: ChatMessage = {
      id: 'user-2000-x',
      role: 'user',
      metadata: { createdAt: at(2000), openframeAttachments: [LOG] },
      parts: [],
    };
    const merged = mergeHistoryWithRealtime({
      processedHistory: [persisted],
      existingMessages: [bubble],
      streamingMessageId: null,
      historyFetchedAt: 5000,
    });
    expect(merged.map(message => message.id)).toEqual(['aaaa0001']);
  });

  it('keeps a bubble whose files are not the persisted row', () => {
    const other: ChatMessage = {
      id: 'user-3000-x',
      role: 'user',
      metadata: { createdAt: at(3000), openframeAttachments: [SHOT] },
      parts: [],
    };
    const merged = mergeHistoryWithRealtime({
      processedHistory: [persisted],
      existingMessages: [persisted, other],
      streamingMessageId: null,
      historyFetchedAt: 5000,
    });
    expect(merged.map(message => message.id)).toEqual(['aaaa0001', 'user-3000-x']);
  });
});

describe('the history read', () => {
  it('asks for the files only while the host says so, page by page', async () => {
    let on = false;
    const post = vi.fn(() => Promise.resolve({ messages: null })) as unknown as MingoGraphqlPost &
      ReturnType<typeof vi.fn>;
    const read = createMingoGraphqlHistory(post, { attachments: () => on });
    await read({ dialogId: 'd1' });
    on = true;
    await read({ dialogId: 'd1' });
    const queries = post.mock.calls.map(call => (call as unknown[])[0]);
    expect(queries[0]).toBe(MINGO_MESSAGES_QUERY);
    expect(queries[1]).toMatch(/attachments \{/);
  });
});

describe('openFrameSentAttachmentOf', () => {
  it("is the ready file under the server's id, without the tile's local picture", () => {
    expect(
      openFrameSentAttachmentOf({
        attachmentId: 'att_9',
        item: {
          id: 'tray-1',
          name: 'shot.png',
          size: 900,
          mediaType: 'image/png',
          state: 'ready',
          thumbnailUrl: 'blob:x',
        },
      }),
    ).toEqual({ id: 'att_9', name: 'shot.png', mediaType: 'image/png', size: 900 });
    expect(
      openFrameSentAttachmentOf({ attachmentId: 'att_8', item: { id: 't', name: 'x', size: 1, state: 'ready' } })
        .mediaType,
    ).toBe('application/octet-stream');
  });
});

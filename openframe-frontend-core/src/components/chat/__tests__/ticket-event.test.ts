/**
 * TICKET_EVENT — the ticket lifecycle receipt (resolved / reopened / open vocabulary), across both the live NATS path and
 * history replay.
 *
 * The behaviours worth pinning:
 *   - the chunk arrives STANDALONE (no MESSAGE_START at all: resolution can fire from a PSA-side action with no turn open),
 *     so it must mint or append to the trailing bubble like `data-ticket-escalated` does;
 *   - dedupe identity is the stream sequence, with payload-equality as the fallback for the hydrate-then-catch-up overlap
 *     where the hydrated twin is seq-less (the persisted row's seq lives on the message, not in `messageData`);
 *   - `kind` is OPEN: an unknown kind decodes and renders, only a missing kind is malformed.
 */

import { describe, expect, it } from 'vitest';
import type { ChatMessage, ChatPart, ChatTicketEventPart } from '../../../chat-protocol/chat-message';
import { createMingoDecoder } from '../../../chat-protocol/message-decoder';
import { createChatStreamReducer } from '../stream/chat-stream-reducer';
import type { HistoricalMessage } from '../types';
import { processHistoricalMessages } from '../utils/process-historical-messages';

const resolvedChunk = (streamSeq: number, over: Record<string, unknown> = {}) => ({
  type: 'TICKET_EVENT',
  kind: 'RESOLVED',
  actorId: 'fae',
  actorName: 'Fae',
  actorType: 'AI',
  streamSeq,
  ...over,
});

const events = (parts: readonly ChatPart[]): ChatTicketEventPart[] =>
  parts.filter((part): part is ChatTicketEventPart => part.type === 'data-ticket-event');
const eventsIn = (messages: readonly ChatMessage[]) => events(messages.flatMap(message => message.parts));

const decode = (raw: unknown) => createMingoDecoder().decode(raw);

/** A reducer fed the wire, chunk by chunk. */
function setup(thread?: ChatMessage[]) {
  const reducer = createChatStreamReducer();
  if (thread) reducer.initializeWithState(thread);
  const decoder = createMingoDecoder();
  const feed = (chunks: unknown[]) => {
    for (const chunk of chunks) reducer.apply(decoder.decode(chunk));
  };
  return { reducer, feed };
}

describe('the decoder — TICKET_EVENT', () => {
  it('decodes the resolution receipt with its actor fields, its time and its sequence', () => {
    const { seq, chunks } = decode(resolvedChunk(7));
    expect(seq).toBe(7);
    expect(chunks).toEqual([
      {
        type: 'data-ticket-event',
        id: '7',
        data: {
          kind: 'RESOLVED',
          actorId: 'fae',
          actorName: 'Fae',
          actorType: 'AI',
          occurredAt: expect.any(String) as string,
        },
      },
    ]);
  });

  it('falls back to the payload `sequenceId` when the transport did not stamp `streamSeq`', () => {
    expect(decode({ type: 'TICKET_EVENT', kind: 'REOPENED', sequenceId: 42 }).chunks[0]).toMatchObject({ id: '42' });
  });

  it('prefers the transport-stamped `streamSeq` over the payload copy', () => {
    expect(decode(resolvedChunk(500, { sequenceId: 499 })).chunks[0]).toMatchObject({ id: '500' });
  });

  it('decodes the reopen target kind and folds blanks away', () => {
    expect(
      decode({ type: 'TICKET_EVENT', kind: 'REOPENED', targetStatusKind: 'TECH_REQUIRED', streamSeq: 8 }).chunks[0],
    ).toMatchObject({ data: { targetStatusKind: 'TECH_REQUIRED' } });
    const [blank] = decode({ type: 'TICKET_EVENT', kind: 'REOPENED', targetStatusKind: ' ', streamSeq: 9 }).chunks;
    expect(blank.type === 'data-ticket-event' && blank.data).not.toHaveProperty('targetStatusKind');
  });

  it('keeps unknown kinds — the vocabulary is open', () => {
    expect(decode({ type: 'TICKET_EVENT', kind: 'ON_HOLD', streamSeq: 1 }).chunks[0]).toMatchObject({
      type: 'data-ticket-event',
      data: { kind: 'ON_HOLD' },
    });
  });

  it('drops only a chunk with no kind at all', () => {
    expect(decode({ type: 'TICKET_EVENT', streamSeq: 1 }).chunks).toEqual([]);
    expect(decode({ type: 'TICKET_EVENT', kind: '  ', streamSeq: 1 }).chunks).toEqual([]);
  });
});

describe('chat stream reducer — ticket event', () => {
  it('renders a receipt arriving with no turn open at all', () => {
    const { reducer, feed } = setup();
    feed([resolvedChunk(1)]);
    expect(eventsIn(reducer.state.messages)).toHaveLength(1);
  });

  it('appends to the trailing bubble without wiping the reply the user is reading', () => {
    const { reducer, feed } = setup();
    feed([
      { type: 'MESSAGE_START', streamSeq: 1 },
      { type: 'TEXT', text: 'Excellent! Feel free to reach out.', streamSeq: 2 },
      { type: 'MESSAGE_END', streamSeq: 3 },
      resolvedChunk(4),
    ]);
    const { parts } = reducer.state.messages[0];
    expect(parts.find(part => part.type === 'text')).toMatchObject({ text: 'Excellent! Feel free to reach out.' });
    expect(events(parts)).toHaveLength(1);
  });

  it('is idempotent across a redelivered chunk (JetStream catch-up)', () => {
    const { reducer, feed } = setup();
    feed([resolvedChunk(2), { type: 'MESSAGE_END', streamSeq: 3 }]);
    // A replay re-decodes the same chunk; the seq gate drops it, but the upsert must hold even if the gate ever moves.
    reducer.apply({ chunks: decode(resolvedChunk(2)).chunks });
    expect(eventsIn(reducer.state.messages)).toHaveLength(1);
  });

  it('keeps distinct lifecycle events distinct (resolve → reopen → resolve)', () => {
    const { reducer, feed } = setup();
    feed([
      resolvedChunk(1),
      { type: 'TICKET_EVENT', kind: 'REOPENED', reason: 'Still broken', streamSeq: 2 },
      resolvedChunk(3, { actorName: 'Roman Smith', actorType: 'TECHNICIAN', actorId: 'u-1' }),
    ]);
    expect(eventsIn(reducer.state.messages)).toHaveLength(3);
  });

  it('stamps a live card with its arrival time, not the bubble timestamp', () => {
    // The chunk carries no event time, so arrival IS the event time for a genuinely live receipt. Without the stamp the card
    // renders the trailing bubble's timestamp: the turn's FIRST row, minutes stale by the time a resolve/reopen lands.
    const { reducer, feed } = setup();
    const before = Date.now();
    feed([resolvedChunk(1)]);
    const after = Date.now();
    const occurredAt = Date.parse(eventsIn(reducer.state.messages)[0].data.occurredAt ?? '');
    expect(occurredAt).toBeGreaterThanOrEqual(before);
    expect(occurredAt).toBeLessThanOrEqual(after);
  });
});

describe('processHistoricalMessages — ticket event', () => {
  const historyRow = (id: string, data: Record<string, unknown>): HistoricalMessage => ({
    id,
    createdAt: '2026-08-06T12:00:00Z',
    owner: { type: 'ASSISTANT' },
    messageData: [data as never],
  });

  it('replays the persisted row through the same decoder as the live path', () => {
    const { messages } = processHistoricalMessages([
      historyRow('m1', {
        type: 'TICKET_EVENT',
        kind: 'REOPENED',
        actorId: 'user-42',
        actorName: 'John Smith',
        actorType: 'CLIENT',
        reason: 'The printer stopped working again',
      }),
    ]);
    expect(messages).toHaveLength(1);
    expect(events(messages[0].parts)[0]).toMatchObject({
      data: { kind: 'REOPENED', reason: 'The printer stopped working again' },
    });
  });

  it('replays the persisted reopen target kind', () => {
    const { messages } = processHistoricalMessages([
      historyRow('m1', { type: 'TICKET_EVENT', kind: 'REOPENED', targetStatusKind: 'AI_ASSISTANCE' }),
    ]);
    expect(events(messages[0].parts)[0]).toMatchObject({
      data: { kind: 'REOPENED', targetStatusKind: 'AI_ASSISTANCE' },
    });
  });

  it('keeps an unknown persisted kind renderable', () => {
    const { messages } = processHistoricalMessages([historyRow('m1', { type: 'TICKET_EVENT', kind: 'ON_HOLD' })]);
    expect(eventsIn(messages)).toHaveLength(1);
  });

  it('skips a malformed row with no kind', () => {
    const { messages } = processHistoricalMessages([historyRow('m1', { type: 'TICKET_EVENT', actorName: 'Fae' })]);
    expect(eventsIn(messages)).toHaveLength(0);
  });

  it('stamps each card with its OWN row time, not the bubble timestamp', () => {
    // The reported bug: resolve/reopen rows grouped into one assistant bubble all rendered the bubble's timestamp, the FIRST
    // row of the turn (the ticket-creation-era greeting), so every lifecycle card read the same stale time.
    const rowAt = (id: string, createdAt: string, data: Record<string, unknown>): HistoricalMessage => ({
      id,
      createdAt,
      owner: { type: 'ASSISTANT' },
      messageData: [data as never],
    });
    const { messages } = processHistoricalMessages([
      rowAt('m1', '2026-08-20T13:54:00.000Z', { type: 'TEXT', text: 'Hi! How can I help?' }),
      rowAt('m2', '2026-08-20T14:10:00.000Z', { type: 'TICKET_EVENT', kind: 'RESOLVED', actorType: 'AI' }),
      rowAt('m3', '2026-08-20T14:33:00.000Z', {
        type: 'TICKET_EVENT',
        kind: 'REOPENED',
        actorType: 'CLIENT',
        targetStatusKind: 'AI_ASSISTANCE',
      }),
    ]);
    expect(messages).toHaveLength(1);
    // The bubble keeps the first row's time…
    expect(messages[0].metadata?.createdAt).toBe('2026-08-20T13:54:00.000Z');
    // …but each card carries the time of its own event.
    expect(events(messages[0].parts).map(card => card.data.occurredAt)).toEqual([
      '2026-08-20T14:10:00.000Z',
      '2026-08-20T14:33:00.000Z',
    ]);
  });
});

describe('processHistoricalMessages — row stream sequence', () => {
  it('stamps the hydrated card with the row seq (standalone row)', () => {
    // TICKET_EVENT chunks are standalone, one per row, so the row's `lastChunkStreamSeq` IS the event's sequence. Without the
    // stamp the hydrated card never joins a stale-consumer/catch-up replay of the same chunk in the store, and the replayed
    // copy rendered as a second identical card (the resolve/reopen duplication).
    const { messages } = processHistoricalMessages([
      {
        id: 'm1',
        createdAt: '2026-08-31T00:54:00Z',
        owner: { type: 'ASSISTANT' },
        lastChunkStreamSeq: 412,
        messageData: [{ type: 'TICKET_EVENT', kind: 'RESOLVED', actorType: 'AI' } as never],
      },
    ]);
    expect(eventsIn(messages)[0].id).toBe('412');
  });

  it('does NOT stamp a bundled row - its seq belongs to the LAST chunk', () => {
    const { messages } = processHistoricalMessages([
      {
        id: 'm1',
        createdAt: '2026-08-31T00:54:00Z',
        owner: { type: 'ASSISTANT' },
        lastChunkStreamSeq: 413,
        messageData: [
          { type: 'TICKET_EVENT', kind: 'RESOLVED', actorType: 'AI' } as never,
          { type: 'TEXT', text: 'trailing text' } as never,
        ],
      },
    ]);
    expect(eventsIn(messages)[0].id).toBeUndefined();
  });
});

describe('reducer over a hydrated thread — the resolve/reopen duplication', () => {
  // The reported bug (admin PSA chat, ticket 86ak8a74d; same lib hole as the desktop dup in 86ak56ehp): reopening a dialog
  // hydrates the persisted TICKET_EVENT row into the thread, then a consumer created with a stale `optStartSeq` replays the
  // same chunk. It used to push the replay beside the hydrated card as a second identical block.
  const REPLY: ChatPart = { type: 'text', text: 'Excellent! Feel free to reach out.' };
  const AT = '2026-08-31T00:54:00.000Z';
  const hydratedThread = (id?: string): ChatMessage[] => [
    {
      id: 'assistant-m1',
      role: 'assistant',
      parts: [
        REPLY,
        {
          type: 'data-ticket-event',
          ...(id !== undefined ? { id } : {}),
          data: { kind: 'RESOLVED', actorType: 'AI', occurredAt: AT },
        },
      ],
    },
  ];
  const REPLAY = { type: 'TICKET_EVENT', kind: 'RESOLVED', actorType: 'AI', streamSeq: 412 };

  it('joins the replay with a seq-stamped hydrated card (one card, row time kept)', () => {
    const { reducer, feed } = setup(hydratedThread('412'));
    feed([REPLAY]);
    const { parts } = reducer.state.messages[0];
    const cards = events(parts);
    expect(cards).toHaveLength(1);
    // First-known time wins: the replay only knows its late arrival time.
    expect(cards[0].data.occurredAt).toBe(AT);
    // The reply the user is reading stays intact.
    expect(parts[0]).toEqual(REPLY);
  });

  it('joins the replay with a seq-LESS hydrated twin (rows persisted before the seq stamp)', () => {
    const { reducer, feed } = setup(hydratedThread());
    feed([REPLAY]);
    const cards = eventsIn(reducer.state.messages);
    expect(cards).toHaveLength(1);
    expect(cards[0].id).toBe('412');
    expect(cards[0].data.occurredAt).toBe(AT);
  });

  it('keeps a genuinely repeated cycle distinct across hydrate + live', () => {
    // resolve (hydrated, seq-less legacy row) -> live reopen -> live resolve payload-identical to the first: only the LAST
    // ticket event may payload-match, so the final resolve renders as its own card.
    const { reducer, feed } = setup(hydratedThread());
    feed([{ type: 'TICKET_EVENT', kind: 'REOPENED', actorType: 'CLIENT', streamSeq: 413 }]);
    feed([{ type: 'TICKET_EVENT', kind: 'RESOLVED', actorType: 'AI', streamSeq: 414 }]);
    expect(eventsIn(reducer.state.messages).map(card => card.data.kind)).toEqual(['RESOLVED', 'REOPENED', 'RESOLVED']);
  });

  it('an entirely seq-less repeated cycle stays three cards', () => {
    const { reducer } = setup();
    const decoder = createMingoDecoder();
    for (const kind of ['RESOLVED', 'REOPENED', 'RESOLVED']) {
      reducer.apply(decoder.decode({ type: 'TICKET_EVENT', kind, actorName: 'Fae', actorType: 'AI' }));
    }
    expect(eventsIn(reducer.state.messages)).toHaveLength(3);
  });

  it('does NOT collapse two different events of the same kind', () => {
    const { reducer, feed } = setup();
    feed([
      { type: 'TICKET_EVENT', kind: 'RESOLVED', actorName: 'Fae', actorType: 'AI', streamSeq: 1 },
      { type: 'TICKET_EVENT', kind: 'RESOLVED', actorName: 'Roman Smith', actorType: 'TECHNICIAN', streamSeq: 9 },
    ]);
    expect(eventsIn(reducer.state.messages)).toHaveLength(2);
  });
});

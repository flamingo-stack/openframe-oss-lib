/**
 * TICKET_EVENT — the ticket lifecycle receipt (resolved / reopened / open
 * vocabulary), across both the live NATS path and history replay.
 *
 * The behaviours worth pinning:
 *   - the chunk arrives STANDALONE (no MESSAGE_START at all — resolution can
 *     fire from a PSA-side action with no turn open), so it must mint/append
 *     to the trailing bubble like `ticket-escalated` does;
 *   - dedupe identity is the stream sequence, with payload-equality as the
 *     fallback for the hydrate-then-catch-up overlap where the hydrated twin
 *     is seq-less (the persisted row's seq lives on the message, not in
 *     `messageData`);
 *   - `kind` is OPEN: an unknown kind decodes and renders, only a missing
 *     kind is malformed.
 */

import { describe, expect, it } from 'vitest';
import { decodeNatsChunk } from '../../../chat-protocol/nats-decoder';
import { createChatStreamReducer } from '../stream/chat-stream-reducer';
import type { HistoricalMessage, MessageSegment, TicketEventSegment } from '../types';
import type { UnifiedChatMessage } from '../types/unified-chat-state.types';
import { MessageSegmentAccumulator } from '../utils/message-segment-accumulator';
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

const events = (segments: MessageSegment[] | string | undefined): TicketEventSegment[] =>
  Array.isArray(segments) ? segments.filter(s => s.type === 'ticket_event') : [];

describe('decodeNatsChunk — TICKET_EVENT', () => {
  it('decodes the resolution receipt with its actor fields', () => {
    expect(decodeNatsChunk(resolvedChunk(7))).toEqual({
      type: 'ticket-event',
      kind: 'RESOLVED',
      actorId: 'fae',
      actorName: 'Fae',
      actorType: 'AI',
      reason: undefined,
      targetStatusKind: undefined,
      seq: 7,
    });
  });

  it('falls back to the payload `sequenceId` when the transport did not stamp `streamSeq`', () => {
    const event = decodeNatsChunk({ type: 'TICKET_EVENT', kind: 'REOPENED', sequenceId: 42 });
    expect(event).toMatchObject({ type: 'ticket-event', seq: 42 });
  });

  it('prefers the transport-stamped `streamSeq` over the payload copy', () => {
    expect(decodeNatsChunk(resolvedChunk(500, { sequenceId: 499 }))).toMatchObject({ seq: 500 });
  });

  it('decodes the reopen target kind and folds blanks to undefined', () => {
    expect(
      decodeNatsChunk({ type: 'TICKET_EVENT', kind: 'REOPENED', targetStatusKind: 'TECH_REQUIRED', streamSeq: 8 }),
    ).toMatchObject({ targetStatusKind: 'TECH_REQUIRED' });
    expect(
      decodeNatsChunk({ type: 'TICKET_EVENT', kind: 'REOPENED', targetStatusKind: ' ', streamSeq: 9 }),
    ).toMatchObject({ targetStatusKind: undefined });
  });

  it('keeps unknown kinds — the vocabulary is open', () => {
    expect(decodeNatsChunk({ type: 'TICKET_EVENT', kind: 'ON_HOLD', streamSeq: 1 })).toMatchObject({
      type: 'ticket-event',
      kind: 'ON_HOLD',
    });
  });

  it('drops only a chunk with no kind at all', () => {
    expect(decodeNatsChunk({ type: 'TICKET_EVENT', streamSeq: 1 })).toBeNull();
    expect(decodeNatsChunk({ type: 'TICKET_EVENT', kind: '  ', streamSeq: 1 })).toBeNull();
  });
});

describe('chat stream reducer — ticket event', () => {
  const trailingSegments = (reducer: ReturnType<typeof createChatStreamReducer>): MessageSegment[] => {
    const { messages } = reducer.state;
    return messages[messages.length - 1]?.segments ?? [];
  };

  const feed = (reducer: ReturnType<typeof createChatStreamReducer>, chunks: unknown[]) => {
    for (const chunk of chunks) {
      const event = decodeNatsChunk(chunk);
      if (event) reducer.apply(event);
    }
  };

  it('renders a receipt arriving with no turn open at all', () => {
    const reducer = createChatStreamReducer({ transport: 'nats' });
    feed(reducer, [resolvedChunk(1)]);
    expect(events(trailingSegments(reducer))).toHaveLength(1);
  });

  it('appends to the trailing bubble without wiping the reply the user is reading', () => {
    const reducer = createChatStreamReducer({ transport: 'nats' });
    feed(reducer, [
      { type: 'MESSAGE_START', streamSeq: 1 },
      { type: 'TEXT', text: 'Excellent! Feel free to reach out.', streamSeq: 2 },
      { type: 'MESSAGE_END', streamSeq: 3 },
      resolvedChunk(4),
    ]);
    const segments = trailingSegments(reducer);
    expect(segments.find((s: MessageSegment) => s.type === 'text')).toMatchObject({
      text: 'Excellent! Feel free to reach out.',
    });
    expect(events(segments)).toHaveLength(1);
  });

  it('is idempotent across a redelivered chunk (JetStream catch-up)', () => {
    const reducer = createChatStreamReducer({ transport: 'nats' });
    feed(reducer, [resolvedChunk(2), { type: 'MESSAGE_END', streamSeq: 3 }]);
    // A replay re-decodes the same chunk; the seq gate drops it, but the
    // upsert must hold even if the gate ever moves.
    const event = decodeNatsChunk(resolvedChunk(2));
    if (event) reducer.apply(event);
    expect(events(trailingSegments(reducer))).toHaveLength(1);
  });

  it('keeps distinct lifecycle events distinct (resolve → reopen → resolve)', () => {
    const reducer = createChatStreamReducer({ transport: 'nats' });
    feed(reducer, [
      resolvedChunk(1),
      { type: 'TICKET_EVENT', kind: 'REOPENED', reason: 'Still broken', streamSeq: 2 },
      resolvedChunk(3, { actorName: 'Roman Smith', actorType: 'TECHNICIAN', actorId: 'u-1' }),
    ]);
    expect(events(trailingSegments(reducer))).toHaveLength(3);
  });

  it('stamps a live card with its arrival time, not the bubble timestamp', () => {
    // The chunk carries no event time, so arrival IS the event time for a
    // genuinely live receipt. Without the stamp the card renders the trailing
    // bubble's timestamp — the turn's FIRST row, minutes stale by the time a
    // resolve/reopen lands.
    const reducer = createChatStreamReducer({ transport: 'nats' });
    const before = Date.now();
    feed(reducer, [resolvedChunk(1)]);
    const after = Date.now();
    const [card] = events(trailingSegments(reducer));
    // `instanceof` carries the "it was stamped, and stamped with a Date"
    // assertion AND narrows `occurredAt` for the two bounds checks — an
    // `expect(...).toBeInstanceOf(...)` asserts but does not narrow.
    const { occurredAt } = card;
    if (!(occurredAt instanceof Date)) throw new Error('live ticket card was not stamped with an arrival time');
    expect(occurredAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(occurredAt.getTime()).toBeLessThanOrEqual(after);
  });
});

describe('accumulator — hydrate/catch-up overlap', () => {
  it('matches a seq-less hydrated twin by payload equality instead of stacking', () => {
    const accumulator = new MessageSegmentAccumulator();
    // Hydrated from history: the persisted row's seq lives on the message,
    // so the restored segment carries none.
    accumulator.addTicketEvent({ kind: 'RESOLVED', actorId: 'fae', actorName: 'Fae', actorType: 'AI' });
    // The same event redelivered live, now with its stream sequence.
    const segments = accumulator.addTicketEvent(
      { kind: 'RESOLVED', actorId: 'fae', actorName: 'Fae', actorType: 'AI' },
      412,
    );
    const rendered = events(segments);
    expect(rendered).toHaveLength(1);
    expect(rendered[0].streamSeq).toBe(412);
  });

  it('does NOT collapse two different events of the same kind', () => {
    const accumulator = new MessageSegmentAccumulator();
    accumulator.addTicketEvent({ kind: 'RESOLVED', actorName: 'Fae', actorType: 'AI' }, 1);
    const segments = accumulator.addTicketEvent(
      { kind: 'RESOLVED', actorName: 'Roman Smith', actorType: 'TECHNICIAN' },
      9,
    );
    expect(events(segments)).toHaveLength(2);
  });

  it('renders a payload-identical REPEATED event whose first occurrence is seq-less', () => {
    // The observed swallow: resolve -> reopen -> resolve by the SAME actor
    // with no reason. The first resolve hydrated from history without a seq,
    // so payload equality matched it against the NEW resolve and the final
    // card never rendered. Only the LATEST ticket event may payload-match.
    const accumulator = new MessageSegmentAccumulator();
    accumulator.addTicketEvent({ kind: 'RESOLVED', actorId: 'u-1', actorName: 'Yevhenii', actorType: 'TECHNICIAN' });
    accumulator.addTicketEvent(
      {
        kind: 'REOPENED',
        actorId: 'u-1',
        actorName: 'Yevhenii',
        actorType: 'TECHNICIAN',
        targetStatusKind: 'TECH_REQUIRED',
      },
      79,
    );
    const segments = accumulator.addTicketEvent(
      { kind: 'RESOLVED', actorId: 'u-1', actorName: 'Yevhenii', actorType: 'TECHNICIAN' },
      80,
    );
    const rendered = events(segments);
    expect(rendered).toHaveLength(3);
    expect(rendered[2].data.kind).toBe('RESOLVED');
  });

  it('renders an entirely seq-less repeated cycle (no sequences anywhere)', () => {
    const accumulator = new MessageSegmentAccumulator();
    accumulator.addTicketEvent({ kind: 'RESOLVED', actorName: 'Fae', actorType: 'AI' });
    accumulator.addTicketEvent({ kind: 'REOPENED', actorName: 'Fae', actorType: 'AI' });
    const segments = accumulator.addTicketEvent({ kind: 'RESOLVED', actorName: 'Fae', actorType: 'AI' });
    expect(events(segments)).toHaveLength(3);
  });
});

describe('chat stream reducer — onTicketEvent effect', () => {
  it('emits the event payload so hosts can move ticket state with the card', () => {
    const seen: unknown[] = [];
    const reducer = createChatStreamReducer({
      transport: 'nats',
      onEffect: effect => {
        if (effect.name === 'onTicketEvent') seen.push(effect.args[0]);
      },
    });
    const event = decodeNatsChunk({
      type: 'TICKET_EVENT',
      kind: 'REOPENED',
      actorId: 'u-1',
      actorName: 'Yevhenii',
      actorType: 'TECHNICIAN',
      targetStatusKind: 'TECH_REQUIRED',
      streamSeq: 5,
    });
    if (event) reducer.apply(event);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ kind: 'REOPENED', targetStatusKind: 'TECH_REQUIRED' });
  });
});

describe('processHistoricalMessages — ticket event', () => {
  const historyRow = (id: string, data: Record<string, unknown>): HistoricalMessage => ({
    id,
    createdAt: '2026-08-06T12:00:00Z',
    owner: { type: 'ASSISTANT' },
    messageData: [data as never],
  });

  it('replays the persisted row through the same mapper as the live path', () => {
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
    expect(events(messages[0].content)[0]).toMatchObject({
      data: { kind: 'REOPENED', reason: 'The printer stopped working again' },
    });
  });

  it('replays the persisted reopen target kind', () => {
    const { messages } = processHistoricalMessages([
      historyRow('m1', { type: 'TICKET_EVENT', kind: 'REOPENED', targetStatusKind: 'AI_ASSISTANCE' }),
    ]);
    expect(events(messages[0].content)[0]).toMatchObject({
      data: { kind: 'REOPENED', targetStatusKind: 'AI_ASSISTANCE' },
    });
  });

  it('keeps an unknown persisted kind renderable', () => {
    const { messages } = processHistoricalMessages([historyRow('m1', { type: 'TICKET_EVENT', kind: 'ON_HOLD' })]);
    expect(events(messages[0]?.content ?? [])).toHaveLength(1);
  });

  it('skips a malformed row with no kind', () => {
    const { messages } = processHistoricalMessages([historyRow('m1', { type: 'TICKET_EVENT', actorName: 'Fae' })]);
    expect(messages.flatMap(m => events(m.content))).toHaveLength(0);
  });

  it('stamps each card with its OWN row time, not the bubble timestamp', () => {
    // The reported bug: resolve/reopen rows grouped into one assistant bubble
    // all rendered the bubble's timestamp — the FIRST row of the turn (the
    // ticket-creation-era greeting), so every lifecycle card read the same
    // stale time.
    const rowAt = (id: string, createdAt: string, data: Record<string, unknown>): HistoricalMessage => ({
      id,
      createdAt,
      owner: { type: 'ASSISTANT' },
      messageData: [data as never],
    });
    const { messages } = processHistoricalMessages([
      rowAt('m1', '2026-08-20T13:54:00Z', { type: 'TEXT', text: 'Hi! How can I help?' }),
      rowAt('m2', '2026-08-20T14:10:00Z', { type: 'TICKET_EVENT', kind: 'RESOLVED', actorType: 'AI' }),
      rowAt('m3', '2026-08-20T14:33:00Z', {
        type: 'TICKET_EVENT',
        kind: 'REOPENED',
        actorType: 'CLIENT',
        targetStatusKind: 'AI_ASSISTANCE',
      }),
    ]);
    expect(messages).toHaveLength(1);
    // The bubble keeps the first row's time…
    expect(messages[0].timestamp).toEqual(new Date('2026-08-20T13:54:00Z'));
    // …but each card carries the time of its own event.
    const cards = events(messages[0].content);
    expect(cards.map(c => c.occurredAt)).toEqual([new Date('2026-08-20T14:10:00Z'), new Date('2026-08-20T14:33:00Z')]);
  });
});

describe('processHistoricalMessages — row stream sequence', () => {
  it('stamps the hydrated card with the row seq (standalone row)', () => {
    // TICKET_EVENT chunks are standalone, one per row, so the row's
    // `lastChunkStreamSeq` IS the event's sequence. Without the stamp the
    // hydrated card never joins a stale-consumer/catch-up replay of the same
    // chunk in the store, and the replayed copy rendered as a second
    // identical card (the resolve/reopen duplication).
    const { messages } = processHistoricalMessages([
      {
        id: 'm1',
        createdAt: '2026-08-31T00:54:00Z',
        owner: { type: 'ASSISTANT' },
        lastChunkStreamSeq: 412,
        messageData: [{ type: 'TICKET_EVENT', kind: 'RESOLVED', actorType: 'AI' } as never],
      },
    ]);
    expect(events(messages[0].content)[0].streamSeq).toBe(412);
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
    expect(events(messages[0].content)[0].streamSeq).toBeUndefined();
  });
});

describe('reducer over a hydrated thread — the resolve/reopen duplication', () => {
  // The reported bug (admin PSA chat, ticket 86ak8a74d; same lib hole as the
  // desktop dup in 86ak56ehp): reopening a dialog hydrates the persisted
  // TICKET_EVENT row into the thread, then a consumer created with a stale
  // `optStartSeq` replays the same chunk. The twins meet ONLY in the store
  // (a complete hydrated tail seeds no accumulator), so the join must happen
  // in `appendToTrailingAssistant` - it used to push the replay beside the
  // hydrated card as a second identical block.
  const hydratedThread = (card: TicketEventSegment): UnifiedChatMessage[] => [
    {
      id: 'assistant-m1',
      role: 'assistant',
      content: '',
      segments: [{ type: 'text', text: 'Excellent! Feel free to reach out.' }, card],
    },
  ];

  const replay = (reducer: ReturnType<typeof createChatStreamReducer>, chunk: unknown) => {
    const event = decodeNatsChunk(chunk);
    if (event) reducer.apply(event);
    return reducer.state.messages[reducer.state.messages.length - 1]?.segments ?? [];
  };

  it('joins the replay with a seq-stamped hydrated card (one card, row time kept)', () => {
    const reducer = createChatStreamReducer({ transport: 'nats' });
    reducer.initializeWithState(
      hydratedThread({
        type: 'ticket_event',
        data: { kind: 'RESOLVED', actorType: 'AI' },
        streamSeq: 412,
        occurredAt: new Date('2026-08-31T00:54:00Z'),
      }),
    );
    const segments = replay(reducer, { type: 'TICKET_EVENT', kind: 'RESOLVED', actorType: 'AI', streamSeq: 412 });
    const cards = events(segments);
    expect(cards).toHaveLength(1);
    // First-known time wins: the replay only knows its late arrival time.
    expect(cards[0].occurredAt).toEqual(new Date('2026-08-31T00:54:00Z'));
    // The reply the user is reading stays intact.
    expect(segments.find(s => s.type === 'text')).toMatchObject({ text: 'Excellent! Feel free to reach out.' });
  });

  it('joins the replay with a seq-LESS hydrated twin (rows persisted before the seq stamp)', () => {
    const reducer = createChatStreamReducer({ transport: 'nats' });
    reducer.initializeWithState(
      hydratedThread({
        type: 'ticket_event',
        data: { kind: 'RESOLVED', actorType: 'AI' },
        occurredAt: new Date('2026-08-31T00:54:00Z'),
      }),
    );
    const cards = events(replay(reducer, { type: 'TICKET_EVENT', kind: 'RESOLVED', actorType: 'AI', streamSeq: 412 }));
    expect(cards).toHaveLength(1);
    expect(cards[0].streamSeq).toBe(412);
    expect(cards[0].occurredAt).toEqual(new Date('2026-08-31T00:54:00Z'));
  });

  it('keeps a genuinely repeated cycle distinct across hydrate + live', () => {
    // resolve (hydrated, seq-less legacy row) -> live reopen -> live resolve
    // payload-identical to the first: only the LAST ticket event may
    // payload-match, so the final resolve renders as its own card.
    const reducer = createChatStreamReducer({ transport: 'nats' });
    reducer.initializeWithState(hydratedThread({ type: 'ticket_event', data: { kind: 'RESOLVED', actorType: 'AI' } }));
    replay(reducer, { type: 'TICKET_EVENT', kind: 'REOPENED', actorType: 'CLIENT', streamSeq: 413 });
    const cards = events(replay(reducer, { type: 'TICKET_EVENT', kind: 'RESOLVED', actorType: 'AI', streamSeq: 414 }));
    expect(cards).toHaveLength(3);
    expect(cards.map(c => c.data.kind)).toEqual(['RESOLVED', 'REOPENED', 'RESOLVED']);
  });
});

describe('accumulator — occurredAt across the hydrate/catch-up overlap', () => {
  it('keeps the hydrated row time when the seq-stamped redelivery carries none', () => {
    const accumulator = new MessageSegmentAccumulator();
    accumulator.addTicketEvent(
      { kind: 'RESOLVED', actorId: 'fae', actorName: 'Fae', actorType: 'AI' },
      undefined,
      new Date('2026-08-20T14:10:00Z'),
    );
    // Same event redelivered live (JetStream catch-up): seq known, time not.
    const segments = accumulator.addTicketEvent(
      { kind: 'RESOLVED', actorId: 'fae', actorName: 'Fae', actorType: 'AI' },
      412,
    );
    const rendered = events(segments);
    expect(rendered).toHaveLength(1);
    expect(rendered[0].streamSeq).toBe(412);
    expect(rendered[0].occurredAt).toEqual(new Date('2026-08-20T14:10:00Z'));
  });

  it('keeps the hydrated row time over a LATE redelivery arrival stamp', () => {
    // Reconnect catch-up redelivers an hour-old event stamped with its (late)
    // arrival time — the hydrated twin's real row time must win.
    const accumulator = new MessageSegmentAccumulator();
    accumulator.addTicketEvent(
      { kind: 'RESOLVED', actorId: 'fae', actorName: 'Fae', actorType: 'AI' },
      undefined,
      new Date('2026-08-20T14:10:00Z'),
    );
    const segments = accumulator.addTicketEvent(
      { kind: 'RESOLVED', actorId: 'fae', actorName: 'Fae', actorType: 'AI' },
      412,
      new Date('2026-08-20T15:10:00Z'),
    );
    const rendered = events(segments);
    expect(rendered).toHaveLength(1);
    expect(rendered[0].occurredAt).toEqual(new Date('2026-08-20T14:10:00Z'));
  });
});

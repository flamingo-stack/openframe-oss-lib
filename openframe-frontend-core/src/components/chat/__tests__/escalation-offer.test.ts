/**
 * Ticket-escalation offer: decode → accumulate → resolve, across both the
 * live NATS path and history replay.
 *
 * The two behaviours worth pinning are the ones that were expensive to get
 * right, not the happy path:
 *   - an offer arriving with NO preceding MESSAGE_START must APPEND to the
 *     trailing bubble, never replace its segments (the backend surfaces
 *     deferred offers after the turn ends, so this is the normal shape, and
 *     a cumulative emit there wipes the reply the user is reading);
 *   - an offer and its resolution are two persisted rows separated by the
 *     user message that caused SUPERSEDED, so the flip has to reach a bubble
 *     that was already flushed.
 */

import { describe, expect, it } from 'vitest';
import { decodeNatsChunk } from '../../../chat-protocol/nats-decoder';
import { createChatStreamReducer } from '../stream/chat-stream-reducer';
import type { EscalationOfferSegment, HistoricalMessage, MessageSegment } from '../types';
import { processHistoricalMessages } from '../utils/process-historical-messages';

const OFFER_ID = 'offer-1';
const OFFER_TEXT = 'Having issues with the AI assistant? This ticket can be handed off to a technician.';

const offerChunk = (streamSeq: number) => ({
  type: 'ESCALATION_OFFER',
  offerId: OFFER_ID,
  state: 'PENDING',
  text: OFFER_TEXT,
  origin: 'MANUAL',
  streamSeq,
});

const resolvedChunk = (state: string, streamSeq: number) => ({
  type: 'ESCALATION_OFFER',
  offerId: OFFER_ID,
  state,
  displayName: 'John Smith',
  streamSeq,
});

const offers = (segments: MessageSegment[] | string | undefined): EscalationOfferSegment[] =>
  Array.isArray(segments) ? segments.filter(s => s.type === 'escalation_offer') : [];

const historyRow = (id: string, data: Record<string, unknown>): HistoricalMessage => ({
  id,
  createdAt: '2026-08-06T12:00:00Z',
  owner: { type: 'ASSISTANT' },
  messageData: [data as never],
});

describe('decodeNatsChunk — ESCALATION_OFFER', () => {
  it('decodes the PENDING chunk as an offer', () => {
    expect(decodeNatsChunk(offerChunk(1))).toEqual({
      type: 'escalation-offer',
      offerId: OFFER_ID,
      text: OFFER_TEXT,
      origin: 'MANUAL',
      seq: 1,
    });
  });

  it('maps the terminal states onto the shared approval-status vocabulary', () => {
    expect(decodeNatsChunk(resolvedChunk('APPROVED', 2))).toMatchObject({ status: 'approved' });
    expect(decodeNatsChunk(resolvedChunk('DECLINED', 3))).toMatchObject({ status: 'rejected' });
    expect(decodeNatsChunk(resolvedChunk('SUPERSEDED', 4))).toMatchObject({ status: 'cancelled' });
  });

  it('reads the resolver from `displayName` (chunk) or `resolvedByName` (row)', () => {
    expect(decodeNatsChunk(resolvedChunk('APPROVED', 5))).toMatchObject({
      resolvedByName: 'John Smith',
    });
    expect(
      decodeNatsChunk({ ...resolvedChunk('APPROVED', 6), displayName: undefined, resolvedByName: 'Ada' }),
    ).toMatchObject({ resolvedByName: 'Ada' });
  });

  it('drops malformed chunks instead of emitting a card with no id', () => {
    expect(decodeNatsChunk({ type: 'ESCALATION_OFFER', state: 'PENDING' })).toBeNull();
    expect(decodeNatsChunk({ type: 'ESCALATION_OFFER', offerId: OFFER_ID, state: 'WAT' })).toBeNull();
  });
});

describe('chat stream reducer — escalation offer', () => {
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

  it('appends to the trailing bubble when the offer arrives after MESSAGE_END', () => {
    const reducer = createChatStreamReducer({ transport: 'nats' });
    feed(reducer, [
      { type: 'MESSAGE_START', streamSeq: 1 },
      { type: 'TEXT', text: 'Let me take a look at that.', streamSeq: 2 },
      { type: 'MESSAGE_END', streamSeq: 3 },
      offerChunk(4),
    ]);

    const segments = trailingSegments(reducer);
    // The prose the user was reading survives — this is the whole point.
    expect(segments.find((s: MessageSegment) => s.type === 'text')).toMatchObject({
      text: 'Let me take a look at that.',
    });
    expect(offers(segments)).toHaveLength(1);
  });

  it('flips the card in place on resolution and stamps the resolver', () => {
    const reducer = createChatStreamReducer({ transport: 'nats' });
    feed(reducer, [{ type: 'MESSAGE_START', streamSeq: 1 }, offerChunk(2), resolvedChunk('APPROVED', 3)]);

    const rendered = offers(trailingSegments(reducer));
    expect(rendered).toHaveLength(1);
    expect(rendered[0]).toMatchObject({ status: 'approved', resolvedByName: 'John Smith' });
  });

  it('does not claim the agent is working while an offer is pending', () => {
    const busy: unknown[] = [];
    const reducer = createChatStreamReducer({
      transport: 'nats',
      onEffect: effect => {
        if (effect.name === 'onAgentBusy') busy.push(effect);
      },
    });
    feed(reducer, [{ type: 'MESSAGE_START', streamSeq: 1 }, offerChunk(2), resolvedChunk('APPROVED', 3)]);
    expect(busy).toHaveLength(0);
  });

  it('is idempotent across a redelivered offer (JetStream catch-up)', () => {
    const reducer = createChatStreamReducer({ transport: 'nats' });
    feed(reducer, [{ type: 'MESSAGE_START', streamSeq: 1 }, offerChunk(2), { type: 'MESSAGE_END', streamSeq: 3 }]);
    // A replay re-decodes the same chunk with its original seq; the seq gate
    // drops it, but the upsert must hold even if the gate ever moves.
    const event = decodeNatsChunk({ ...offerChunk(2), streamSeq: 9 });
    if (event) reducer.apply(event);
    expect(offers(trailingSegments(reducer))).toHaveLength(1);
  });
});

describe('processHistoricalMessages — escalation offer', () => {
  it('renders the offer inline rather than deferring it to the sticky flush', () => {
    const { messages } = processHistoricalMessages([
      historyRow('m1', {
        type: 'ESCALATION_OFFER',
        offerId: OFFER_ID,
        state: 'PENDING',
        text: OFFER_TEXT,
        origin: 'MANUAL',
      }),
    ]);
    expect(messages).toHaveLength(1);
    expect(offers(messages[0].content)[0]).toMatchObject({ status: 'pending' });
  });

  it('flips a card that was flushed into an EARLIER bubble than its resolution', () => {
    const { messages } = processHistoricalMessages([
      historyRow('m1', {
        type: 'ESCALATION_OFFER',
        offerId: OFFER_ID,
        state: 'PENDING',
        text: OFFER_TEXT,
      }),
      // The user typing is exactly what produces SUPERSEDED, so this message
      // is not incidental — it is what splits the two rows apart.
      {
        id: 'm2',
        createdAt: '2026-08-06T12:01:00Z',
        owner: { type: 'CLIENT' },
        messageData: [{ type: 'TEXT', text: 'actually, never mind' } as never],
      },
      historyRow('m3', {
        type: 'ESCALATION_OFFER',
        offerId: OFFER_ID,
        state: 'SUPERSEDED',
        resolvedByName: 'John Smith',
      }),
    ]);

    const rendered = messages.flatMap(m => offers(m.content));
    expect(rendered).toHaveLength(1);
    expect(rendered[0]).toMatchObject({ status: 'cancelled', resolvedByName: 'John Smith' });
    // Card text comes from the PENDING row; the resolution row carries none.
    expect(rendered[0].data.text).toBe(OFFER_TEXT);
  });

  it('honours the host overlay when the resolution row is not in the fetched pages', () => {
    const { messages } = processHistoricalMessages(
      [
        historyRow('m1', {
          type: 'ESCALATION_OFFER',
          offerId: OFFER_ID,
          state: 'PENDING',
          text: OFFER_TEXT,
        }),
      ],
      { escalationOfferStates: { [OFFER_ID]: 'approved' } },
    );
    expect(messages.flatMap(m => offers(m.content))[0]).toMatchObject({ status: 'approved' });
  });
});

describe('TICKET_ESCALATED — the handoff receipt', () => {
  const escalated = (over = {}) => ({
    type: 'TICKET_ESCALATED',
    ticketId: 't-1',
    ticketNumber: 1002,
    reason: 'INACTIVITY',
    text: 'Automatically escalated to a human technician because the conversation had no new messages.',
    ...over,
  });

  const receipts = (segments: MessageSegment[] | string | undefined) =>
    Array.isArray(segments) ? segments.filter(s => s.type === 'ticket_escalated') : [];

  it('decodes the chunk, keeping the backend copy verbatim', () => {
    expect(decodeNatsChunk({ ...escalated(), streamSeq: 42 })).toEqual({
      type: 'ticket-escalated',
      ticketId: 't-1',
      ticketNumber: 1002,
      reason: 'INACTIVITY',
      text: 'Automatically escalated to a human technician because the conversation had no new messages.',
      seq: 42,
    });
  });

  it('drops payloads missing a non-null wire field', () => {
    expect(decodeNatsChunk({ type: 'TICKET_ESCALATED', reason: 'INACTIVITY' })).toBeNull();
    expect(decodeNatsChunk({ type: 'TICKET_ESCALATED', ticketId: 't-1' })).toBeNull();
  });

  it('survives an unknown reason without a client change', () => {
    expect(decodeNatsChunk(escalated({ reason: 'USER_REQUESTED' }))).toMatchObject({
      reason: 'USER_REQUESTED',
    });
  });

  it('appends to the trailing bubble when it arrives with no turn open', () => {
    // The inactivity auto-escalation fires from a scheduler: no MESSAGE_START
    // precedes it, so a cumulative emit here would wipe the last reply.
    const reducer = createChatStreamReducer({ transport: 'nats' });
    for (const chunk of [
      { type: 'MESSAGE_START', streamSeq: 1 },
      { type: 'TEXT', text: 'Let me look into that.', streamSeq: 2 },
      { type: 'MESSAGE_END', streamSeq: 3 },
      { ...escalated(), streamSeq: 4 },
    ]) {
      const event = decodeNatsChunk(chunk);
      if (event) reducer.apply(event);
    }
    const { messages } = reducer.state;
    const segments = messages[messages.length - 1]?.segments ?? [];
    expect(segments.find((s: MessageSegment) => s.type === 'text')).toMatchObject({
      text: 'Let me look into that.',
    });
    expect(receipts(segments)).toHaveLength(1);
  });

  it('renders on history replay with no escalation offer anywhere in the thread', () => {
    const { messages } = processHistoricalMessages([historyRow('m1', escalated())]);
    const rendered = messages.flatMap(m => receipts(m.content));
    expect(rendered).toHaveLength(1);
    expect(rendered[0]).toMatchObject({ data: { ticketId: 't-1', reason: 'INACTIVITY' } });
  });
});

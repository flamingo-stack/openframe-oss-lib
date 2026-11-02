/**
 * Ticket-escalation offer: decode → part → resolve, across both the live NATS path and history replay.
 *
 * The two behaviours worth pinning are the ones that were expensive to get right, not the happy path:
 *   - an offer arriving with NO preceding MESSAGE_START must APPEND to the trailing bubble, never replace its parts (the
 *     backend surfaces deferred offers after the turn ends, so this is the normal shape);
 *   - an offer and its resolution are two persisted rows separated by the user message that caused SUPERSEDED, so the flip
 *     has to reach a bubble that was already flushed.
 */

import { describe, expect, it } from 'vitest';
import type { ChatEscalationOfferPart, ChatMessage, ChatPart } from '../../../chat-protocol/chat-message';
import { createMingoDecoder } from '../../../chat-protocol/message-decoder';
import { createChatStreamReducer } from '../stream/chat-stream-reducer';
import type { HistoricalMessage } from '../types';
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

const offers = (parts: readonly ChatPart[]): ChatEscalationOfferPart[] =>
  parts.filter((part): part is ChatEscalationOfferPart => part.type === 'data-escalation-offer');
const offersIn = (messages: readonly ChatMessage[]) => offers(messages.flatMap(message => message.parts));

const historyRow = (id: string, data: Record<string, unknown>): HistoricalMessage => ({
  id,
  createdAt: '2026-08-06T12:00:00Z',
  owner: { type: 'ASSISTANT' },
  messageData: [data as never],
});

const chunksOf = (raw: unknown) => createMingoDecoder().decode(raw).chunks;

describe('the decoder — ESCALATION_OFFER', () => {
  it('decodes the PENDING chunk as an offer', () => {
    expect(chunksOf(offerChunk(1))).toEqual([
      {
        type: 'data-escalation-offer',
        id: OFFER_ID,
        data: { text: OFFER_TEXT, status: 'pending', origin: 'MANUAL' },
      },
    ]);
  });

  it('maps the terminal states onto the shared approval-status vocabulary', () => {
    const statusOf = (state: string) => offerStatusOf(chunksOf(resolvedChunk(state, 2)));
    expect(statusOf('APPROVED')).toBe('approved');
    expect(statusOf('DECLINED')).toBe('rejected');
    expect(statusOf('SUPERSEDED')).toBe('cancelled');
  });

  it('reads the resolver from `displayName` (chunk) or `resolvedByName` (row)', () => {
    expect(chunksOf(resolvedChunk('APPROVED', 5))[0]).toMatchObject({ data: { resolvedByName: 'John Smith' } });
    expect(
      chunksOf({ ...resolvedChunk('APPROVED', 6), displayName: undefined, resolvedByName: 'Ada' })[0],
    ).toMatchObject({ data: { resolvedByName: 'Ada' } });
  });

  it('drops malformed chunks instead of emitting a card with no id', () => {
    expect(chunksOf({ type: 'ESCALATION_OFFER', state: 'PENDING' })).toEqual([]);
    expect(chunksOf({ type: 'ESCALATION_OFFER', offerId: OFFER_ID, state: 'WAT' })).toEqual([]);
  });
});

function offerStatusOf(chunks: ReturnType<typeof chunksOf>): unknown {
  const [chunk] = chunks;
  return chunk.type === 'data-escalation-offer' ? chunk.data.status : undefined;
}

describe('chat stream reducer — escalation offer', () => {
  const setup = () => {
    const reducer = createChatStreamReducer();
    const decoder = createMingoDecoder();
    const feed = (chunks: unknown[]) => {
      for (const chunk of chunks) reducer.apply(decoder.decode(chunk));
    };
    return { reducer, feed };
  };

  it('appends to the trailing bubble when the offer arrives after MESSAGE_END', () => {
    const { reducer, feed } = setup();
    feed([
      { type: 'MESSAGE_START', streamSeq: 1 },
      { type: 'TEXT', text: 'Let me take a look at that.', streamSeq: 2 },
      { type: 'MESSAGE_END', streamSeq: 3 },
      offerChunk(4),
    ]);

    const [trailing] = reducer.state.messages;
    // The prose the user was reading survives: this is the whole point.
    expect(trailing.parts.find(part => part.type === 'text')).toMatchObject({ text: 'Let me take a look at that.' });
    expect(offers(trailing.parts)).toHaveLength(1);
  });

  it('flips the card in place on resolution and stamps the resolver', () => {
    const { reducer, feed } = setup();
    feed([{ type: 'MESSAGE_START', streamSeq: 1 }, offerChunk(2), resolvedChunk('APPROVED', 3)]);

    const rendered = offersIn(reducer.state.messages);
    expect(rendered).toHaveLength(1);
    expect(rendered[0].data).toEqual({
      text: OFFER_TEXT,
      status: 'approved',
      origin: 'MANUAL',
      resolvedByName: 'John Smith',
    });
    expect(reducer.state.approvalStatuses[OFFER_ID]).toBe('approved');
  });

  it('does not claim the agent is working while an offer is pending, or after it is answered', () => {
    const { reducer, feed } = setup();
    feed([offerChunk(1)]);
    expect(reducer.state.streamingPhase).toBe('idle');
    feed([resolvedChunk('APPROVED', 2)]);
    expect(reducer.state.streamingPhase).toBe('idle');
  });

  it('is idempotent across a redelivered offer (JetStream catch-up)', () => {
    const { reducer, feed } = setup();
    feed([{ type: 'MESSAGE_START', streamSeq: 1 }, offerChunk(2), { type: 'MESSAGE_END', streamSeq: 3 }]);
    // A replay re-decodes the same chunk with its original seq; the seq gate drops it, but the upsert must hold even if the
    // gate ever moves.
    feed([{ ...offerChunk(2), streamSeq: 9 }]);
    expect(offersIn(reducer.state.messages)).toHaveLength(1);
  });

  it('a pending replay keeps the answer this client already knows', () => {
    const reducer = createChatStreamReducer({ approvalStatuses: { [OFFER_ID]: 'rejected' } });
    reducer.apply(createMingoDecoder().decode(offerChunk(1)));
    expect(offersIn(reducer.state.messages)[0].data.status).toBe('rejected');
  });

  it('a resolution told from another side reaches its card, whichever message holds it', () => {
    const { reducer, feed } = setup();
    feed([offerChunk(1), { type: 'MESSAGE_START', streamSeq: 2 }, { type: 'TEXT', text: 'later', streamSeq: 3 }]);
    reducer.projectApprovalResolution(OFFER_ID, 'cancelled', 'Ada');
    expect(offersIn(reducer.state.messages)[0].data).toMatchObject({ status: 'cancelled', resolvedByName: 'Ada' });
  });
});

describe('processHistoricalMessages — escalation offer', () => {
  it('renders the offer inline', () => {
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
    expect(offers(messages[0].parts)[0].data.status).toBe('pending');
  });

  it('flips a card that was flushed into an EARLIER bubble than its resolution', () => {
    const { messages } = processHistoricalMessages([
      historyRow('m1', {
        type: 'ESCALATION_OFFER',
        offerId: OFFER_ID,
        state: 'PENDING',
        text: OFFER_TEXT,
      }),
      // The user typing is exactly what produces SUPERSEDED, so this message is not incidental: it is what splits the two
      // rows apart.
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

    const rendered = offersIn(messages);
    expect(rendered).toHaveLength(1);
    expect(rendered[0].data).toMatchObject({ status: 'cancelled', resolvedByName: 'John Smith' });
    // Card text comes from the PENDING row; the resolution row carries none.
    expect(rendered[0].data.text).toBe(OFFER_TEXT);
    // The resolution's own row drew nothing.
    expect(messages.map(message => message.id)).toEqual(['m1', 'm2']);
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
    expect(offersIn(messages)[0].data.status).toBe('approved');
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

  const receipts = (parts: readonly ChatPart[]) => parts.filter(part => part.type === 'data-ticket-escalated');

  it('decodes the chunk, keeping the backend copy verbatim', () => {
    expect(chunksOf({ ...escalated(), streamSeq: 42 })).toEqual([
      {
        type: 'data-ticket-escalated',
        id: 't-1',
        data: {
          ticketId: 't-1',
          ticketNumber: 1002,
          reason: 'INACTIVITY',
          text: 'Automatically escalated to a human technician because the conversation had no new messages.',
        },
      },
    ]);
  });

  it('drops payloads missing a non-null wire field', () => {
    expect(chunksOf({ type: 'TICKET_ESCALATED', reason: 'INACTIVITY' })).toEqual([]);
    expect(chunksOf({ type: 'TICKET_ESCALATED', ticketId: 't-1' })).toEqual([]);
  });

  it('survives an unknown reason without a client change', () => {
    expect(chunksOf(escalated({ reason: 'USER_REQUESTED' }))[0]).toMatchObject({ data: { reason: 'USER_REQUESTED' } });
  });

  it('appends to the trailing bubble when it arrives with no turn open', () => {
    // The inactivity auto-escalation fires from a scheduler: no MESSAGE_START precedes it, and it must not wipe the last
    // reply.
    const reducer = createChatStreamReducer();
    const decoder = createMingoDecoder();
    for (const chunk of [
      { type: 'MESSAGE_START', streamSeq: 1 },
      { type: 'TEXT', text: 'Let me look into that.', streamSeq: 2 },
      { type: 'MESSAGE_END', streamSeq: 3 },
      { ...escalated(), streamSeq: 4 },
    ]) {
      reducer.apply(decoder.decode(chunk));
    }
    const { parts } = reducer.state.messages[0];
    expect(parts.find(part => part.type === 'text')).toMatchObject({ text: 'Let me look into that.' });
    expect(receipts(parts)).toHaveLength(1);
  });

  it('renders on history replay with no escalation offer anywhere in the thread', () => {
    const { messages } = processHistoricalMessages([historyRow('m1', escalated())]);
    const rendered = receipts(messages.flatMap(m => m.parts));
    expect(rendered).toHaveLength(1);
    expect(rendered[0]).toMatchObject({ data: { ticketId: 't-1', reason: 'INACTIVITY' } });
  });
});

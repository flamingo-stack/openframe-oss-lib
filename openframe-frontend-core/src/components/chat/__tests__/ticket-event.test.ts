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

import { describe, expect, it } from 'vitest'
import { decodeNatsChunk } from '../../../chat-protocol/nats-decoder'
import { createChatStreamReducer } from '../stream/chat-stream-reducer'
import { MessageSegmentAccumulator } from '../utils/message-segment-accumulator'
import { processHistoricalMessages } from '../utils/process-historical-messages'
import type { HistoricalMessage, MessageSegment, TicketEventSegment } from '../types'

const resolvedChunk = (streamSeq: number, over: Record<string, unknown> = {}) => ({
  type: 'TICKET_EVENT',
  kind: 'RESOLVED',
  actorId: 'fae',
  actorName: 'Fae',
  actorType: 'AI',
  streamSeq,
  ...over,
})

const events = (segments: MessageSegment[] | string | undefined): TicketEventSegment[] =>
  Array.isArray(segments)
    ? (segments.filter((s) => s.type === 'ticket_event') as TicketEventSegment[])
    : []

describe('decodeNatsChunk — TICKET_EVENT', () => {
  it('decodes the resolution receipt with its actor fields', () => {
    expect(decodeNatsChunk(resolvedChunk(7))).toEqual({
      type: 'ticket-event',
      kind: 'RESOLVED',
      actorId: 'fae',
      actorName: 'Fae',
      actorType: 'AI',
      reason: undefined,
      seq: 7,
    })
  })

  it('falls back to the payload `sequenceId` when the transport did not stamp `streamSeq`', () => {
    const event = decodeNatsChunk({ type: 'TICKET_EVENT', kind: 'REOPENED', sequenceId: 42 })
    expect(event).toMatchObject({ type: 'ticket-event', seq: 42 })
  })

  it('prefers the transport-stamped `streamSeq` over the payload copy', () => {
    expect(decodeNatsChunk(resolvedChunk(500, { sequenceId: 499 }))).toMatchObject({ seq: 500 })
  })

  it('keeps unknown kinds — the vocabulary is open', () => {
    expect(decodeNatsChunk({ type: 'TICKET_EVENT', kind: 'ON_HOLD', streamSeq: 1 })).toMatchObject({
      type: 'ticket-event',
      kind: 'ON_HOLD',
    })
  })

  it('drops only a chunk with no kind at all', () => {
    expect(decodeNatsChunk({ type: 'TICKET_EVENT', streamSeq: 1 })).toBeNull()
    expect(decodeNatsChunk({ type: 'TICKET_EVENT', kind: '  ', streamSeq: 1 })).toBeNull()
  })
})

describe('chat stream reducer — ticket event', () => {
  const trailingSegments = (reducer: ReturnType<typeof createChatStreamReducer>): MessageSegment[] => {
    const { messages } = reducer.state
    return messages[messages.length - 1]?.segments ?? []
  }

  const feed = (reducer: ReturnType<typeof createChatStreamReducer>, chunks: unknown[]) => {
    for (const chunk of chunks) {
      const event = decodeNatsChunk(chunk)
      if (event) reducer.apply(event)
    }
  }

  it('renders a receipt arriving with no turn open at all', () => {
    const reducer = createChatStreamReducer({ transport: 'nats' })
    feed(reducer, [resolvedChunk(1)])
    expect(events(trailingSegments(reducer))).toHaveLength(1)
  })

  it('appends to the trailing bubble without wiping the reply the user is reading', () => {
    const reducer = createChatStreamReducer({ transport: 'nats' })
    feed(reducer, [
      { type: 'MESSAGE_START', streamSeq: 1 },
      { type: 'TEXT', text: 'Excellent! Feel free to reach out.', streamSeq: 2 },
      { type: 'MESSAGE_END', streamSeq: 3 },
      resolvedChunk(4),
    ])
    const segments = trailingSegments(reducer)
    expect(segments.find((s: MessageSegment) => s.type === 'text')).toMatchObject({
      text: 'Excellent! Feel free to reach out.',
    })
    expect(events(segments)).toHaveLength(1)
  })

  it('is idempotent across a redelivered chunk (JetStream catch-up)', () => {
    const reducer = createChatStreamReducer({ transport: 'nats' })
    feed(reducer, [resolvedChunk(2), { type: 'MESSAGE_END', streamSeq: 3 }])
    // A replay re-decodes the same chunk; the seq gate drops it, but the
    // upsert must hold even if the gate ever moves.
    const event = decodeNatsChunk(resolvedChunk(2))
    if (event) reducer.apply(event)
    expect(events(trailingSegments(reducer))).toHaveLength(1)
  })

  it('keeps distinct lifecycle events distinct (resolve → reopen → resolve)', () => {
    const reducer = createChatStreamReducer({ transport: 'nats' })
    feed(reducer, [
      resolvedChunk(1),
      { type: 'TICKET_EVENT', kind: 'REOPENED', reason: 'Still broken', streamSeq: 2 },
      resolvedChunk(3, { actorName: 'Roman Smith', actorType: 'TECHNICIAN', actorId: 'u-1' }),
    ])
    expect(events(trailingSegments(reducer))).toHaveLength(3)
  })
})

describe('accumulator — hydrate/catch-up overlap', () => {
  it('matches a seq-less hydrated twin by payload equality instead of stacking', () => {
    const accumulator = new MessageSegmentAccumulator()
    // Hydrated from history: the persisted row's seq lives on the message,
    // so the restored segment carries none.
    accumulator.addTicketEvent({ kind: 'RESOLVED', actorId: 'fae', actorName: 'Fae', actorType: 'AI' })
    // The same event redelivered live, now with its stream sequence.
    const segments = accumulator.addTicketEvent(
      { kind: 'RESOLVED', actorId: 'fae', actorName: 'Fae', actorType: 'AI' },
      412,
    )
    const rendered = events(segments)
    expect(rendered).toHaveLength(1)
    expect(rendered[0].streamSeq).toBe(412)
  })

  it('does NOT collapse two different events of the same kind', () => {
    const accumulator = new MessageSegmentAccumulator()
    accumulator.addTicketEvent({ kind: 'RESOLVED', actorName: 'Fae', actorType: 'AI' }, 1)
    const segments = accumulator.addTicketEvent(
      { kind: 'RESOLVED', actorName: 'Roman Smith', actorType: 'TECHNICIAN' },
      9,
    )
    expect(events(segments)).toHaveLength(2)
  })
})

describe('processHistoricalMessages — ticket event', () => {
  const historyRow = (id: string, data: Record<string, unknown>): HistoricalMessage => ({
    id,
    createdAt: '2026-08-06T12:00:00Z',
    owner: { type: 'ASSISTANT' },
    messageData: [data as never],
  })

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
    ])
    expect(messages).toHaveLength(1)
    expect(events(messages[0].content)[0]).toMatchObject({
      data: { kind: 'REOPENED', reason: 'The printer stopped working again' },
    })
  })

  it('keeps an unknown persisted kind renderable', () => {
    const { messages } = processHistoricalMessages([
      historyRow('m1', { type: 'TICKET_EVENT', kind: 'ON_HOLD' }),
    ])
    expect(events(messages[0]?.content ?? [])).toHaveLength(1)
  })

  it('skips a malformed row with no kind', () => {
    const { messages } = processHistoricalMessages([
      historyRow('m1', { type: 'TICKET_EVENT', actorName: 'Fae' }),
    ])
    expect(messages.flatMap((m) => events(m.content))).toHaveLength(0)
  })
})

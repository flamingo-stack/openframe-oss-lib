/**
 * Unit tests for the chat wire-protocol SSOT (`src/chat-protocol/`) —
 * the decoder state machine, the encoders, and their round-trip. The
 * adapter-level golden fixtures
 * (`src/components/chat/hooks/__tests__/sse-stream-golden.test.ts`) pin
 * the full hook path; these pin the protocol module in isolation.
 */

import { describe, it, expect } from 'vitest'
import {
  createSseFrameDecoder,
  escapeThinkingTags,
  encodeLeadingFrame,
  encodeEndOfLeading,
  encodeTextDelta,
  encodeTrailingUsageFrame,
  stripSentinelBytes,
  decodeNatsChunk,
  END_OF_LEADING,
  TRAILER_SENTINEL,
  FRAME_TERMINATOR,
  type ChatStreamEvent,
  type SseTrailingUsageFrame,
} from '../index'

const enc = new TextEncoder()

/** Run a full stream through a fresh decoder: push each chunk, then end(). */
function decodeAll(chunks: Array<string | Uint8Array>): ChatStreamEvent[] {
  const decoder = createSseFrameDecoder()
  const out: ChatStreamEvent[] = []
  for (const c of chunks) {
    out.push(...decoder.push(typeof c === 'string' ? enc.encode(c) : c))
  }
  out.push(...decoder.end())
  return out
}

const TRAILER: SseTrailingUsageFrame = {
  kind: 'usage',
  stage: 'end',
  input_tokens: 1234,
  output_tokens: 56,
  hit_rate_pct: 81.5,
  breakdown: {
    haikuRewriter: { input: 10, output: 4 },
    routedAnswer: { model: 'claude-sonnet-x', complexity: 'default', thinkingBudget: 0 },
  },
}

describe('createSseFrameDecoder', () => {
  it('decodes everything arriving in ONE chunk (frames + sentinel + text + trailer)', () => {
    const wire =
      '{"status":"thinking"}\0' +
      '{"kind":"thinking-delta","text":"hmm "}\0' +
      '{"sources":[{"index":1}],"model":"m","modelLabel":"M","provider":"anthropic","contextWindowMaxTokens":200000}\0' +
      '{"kind":"usage","stage":"start","input_tokens":11}\0' +
      END_OF_LEADING +
      'One-chunk answer.' +
      TRAILER_SENTINEL +
      JSON.stringify(TRAILER)
    const events = decodeAll([wire])
    expect(events).toEqual([
      { type: 'status', phase: 'thinking' },
      { type: 'thinking-delta', text: 'hmm ' },
      {
        type: 'metadata',
        sources: [{ index: 1 }],
        refs: undefined,
        provider: 'anthropic',
        modelLabel: 'M',
        modelName: 'm',
        contextWindowMaxTokens: 200000,
        scrollAnchor: undefined,
      },
      {
        type: 'usage',
        stage: 'start',
        input_tokens: 11,
        cache_read_input_tokens: undefined,
        cache_creation_input_tokens: undefined,
      },
      { type: 'turn-start' },
      { type: 'text-delta', text: 'One-chunk answer.' },
      {
        type: 'usage',
        stage: 'end',
        input_tokens: 1234,
        output_tokens: 56,
        cache_read_input_tokens: undefined,
        cache_creation_input_tokens: undefined,
        hit_rate_pct: 81.5,
        telemetry: undefined,
        breakdown: TRAILER.breakdown,
        debug: undefined,
      },
    ])
  })

  it('parses a trailer split across pushes only at end()', () => {
    const decoder = createSseFrameDecoder()
    const events: ChatStreamEvent[] = []
    events.push(...decoder.push(enc.encode(END_OF_LEADING + 'answer')))
    events.push(
      ...decoder.push(enc.encode(TRAILER_SENTINEL + '{"kind":"usage","stage":"end","input_to')),
    )
    events.push(...decoder.push(enc.encode('kens":42,"output_tokens":9}')))
    // No usage event until end() — trailer runs to stream end.
    expect(events.map((e) => e.type)).toEqual(['turn-start', 'text-delta'])
    const endEvents = decoder.end()
    expect(endEvents).toHaveLength(1)
    expect(endEvents[0]).toMatchObject({
      type: 'usage',
      stage: 'end',
      input_tokens: 42,
      output_tokens: 9,
    })
  })

  it('end() is IDEMPOTENT: a second call emits the usage frame zero more times', () => {
    // Adapters routinely call end() from BOTH their completion path and a
    // `finally`; a re-emitted usage event would double the displayed token
    // cost.
    const decoder = createSseFrameDecoder()
    decoder.push(
      enc.encode(
        END_OF_LEADING +
          'answer' +
          TRAILER_SENTINEL +
          '{"kind":"usage","stage":"end","input_tokens":42,"output_tokens":9}',
      ),
    )
    const first = decoder.end()
    expect(first).toHaveLength(1)
    expect(first[0]).toMatchObject({ type: 'usage', stage: 'end', input_tokens: 42 })
    expect(decoder.end()).toEqual([])
    expect(decoder.end()).toEqual([])
  })

  it('silently ignores a malformed trailer at end()', () => {
    const decoder = createSseFrameDecoder()
    decoder.push(enc.encode(END_OF_LEADING + 'x' + TRAILER_SENTINEL + 'not json'))
    expect(decoder.end()).toEqual([])
  })

  it('decodes a multi-byte UTF-8 character split across pushes intact', () => {
    const flamingo = enc.encode('🦩') // F0 9F A6 A9
    const events = decodeAll([
      END_OF_LEADING + 'A wild ',
      flamingo.slice(0, 2),
      flamingo.slice(2),
      ' appears',
    ])
    const text = events
      .filter((e): e is Extract<ChatStreamEvent, { type: 'text-delta' }> => e.type === 'text-delta')
      .map((e) => e.text)
      .join('')
    expect(text).toBe('A wild 🦩 appears')
    // The partial code point decodes to an EMPTY delta first (legacy
    // parity: text-mode chunks are emitted unconditionally).
    expect(events.map((e) => e.type)).toEqual([
      'turn-start',
      'text-delta',
      'text-delta',
      'text-delta',
      'text-delta',
    ])
  })

  it('emits thinking deltas VERBATIM (append-only) — escape(concat) === concat(escape), even with a tag split across deltas', () => {
    const events = decodeAll([
      '{"kind":"thinking-delta","text":"use <scr"}\0',
      '{"kind":"thinking-delta","text":"ipt> carefully"}\0',
    ])
    const deltas = events.filter(
      (e): e is Extract<ChatStreamEvent, { type: 'thinking-delta' }> =>
        e.type === 'thinking-delta',
    )
    expect(deltas.map((d) => d.text)).toEqual(['use <scr', 'ipt> carefully'])
    const raw = deltas.map((d) => d.text).join('')
    expect(raw).toBe('use <script> carefully')
    // escapeThinkingTags is per-character, so it distributes over
    // concatenation — accumulate-then-escape and escape-per-delta agree.
    expect(escapeThinkingTags(raw)).toBe('use &lt;script> carefully')
    expect(deltas.map((d) => escapeThinkingTags(d.text)).join('')).toBe(
      escapeThinkingTags(raw),
    )
  })

  it('falls back to answer-text mode when a leading block is not JSON (implicit turn-start, whole buffer emitted)', () => {
    const events = decodeAll(['plain text answer with no frames\0and more after the nul'])
    expect(events).toEqual([
      { type: 'turn-start', implicit: true },
      { type: 'text-delta', text: 'plain text answer with no frames\0and more after the nul' },
    ])
  })

  it('handles sentinel + text + trailer inside the post-sentinel slice of one chunk', () => {
    const events = decodeAll([
      '{"status":"thinking"}\0' +
        END_OF_LEADING +
        'short' +
        TRAILER_SENTINEL +
        '{"kind":"usage","stage":"end","input_tokens":1}',
    ])
    expect(events.map((e) => e.type)).toEqual(['status', 'turn-start', 'text-delta', 'usage'])
  })

  it('drops an un-terminated leading buffer at end() (legacy parity)', () => {
    const decoder = createSseFrameDecoder()
    expect(decoder.push(enc.encode('{"kind":"thinking-de'))).toEqual([])
    expect(decoder.end()).toEqual([])
  })

  it('maps tool frames: text-leading, tool_error, approval_request, decision_resolved', () => {
    const events = decodeAll([
      '{"kind":"text-leading","text":"I\'ll open a ticket."}\0',
      '{"kind":"tool_error","toolName":"create_ticket","message":""}\0',
      '{"kind":"approval_request","proposalId":"prop-1","toolName":"create_ticket","title":"Create ticket","fields":[{"label":"Subject","value":"Printer down"},{"bad":"row"}]}\0',
      '{"kind":"decision_resolved","proposalId":"prop-1","ok":true,"action":"approved","willAutoContinue":true,"tool_name":"create_ticket","result":{"ticket_id":"T-1"},"card":{"type":"ticket","marker":"[card://ticket:T-1]","ref":{"type":"ticket","id":"T-1","title":"t","url":null}},"receiptText":"Done."}\0',
    ])
    expect(events).toEqual([
      { type: 'text-delta', text: "I'll open a ticket.", leading: true },
      // Empty message falls back to the canned copy (legacy parity).
      { type: 'error', title: 'Could not complete the requested action right now.' },
      {
        type: 'approval-request',
        requestId: 'prop-1',
        approvalType: 'create_ticket',
        command: 'Create ticket',
        fields: [{ label: 'Subject', value: 'Printer down' }],
        status: 'pending',
      },
      {
        type: 'approval-resolved',
        status: 'approved',
        ok: true,
        willAutoContinue: true,
        toolName: 'create_ticket',
        result: { ticket_id: 'T-1' },
        marker: '[card://ticket:T-1]',
        cardRef: { type: 'ticket', id: 'T-1', title: 't', url: null },
        cardType: 'ticket',
        receiptText: 'Done.',
        requestId: 'prop-1',
      },
    ])
  })

  it('routing frame → metadata.routing; non-string routedComplexity emits nothing', () => {
    const events = decodeAll([
      '{"kind":"routing","routedComplexity":"simple","routedThinkingBudget":0}\0',
      '{"kind":"routing","routedComplexity":42}\0',
    ])
    expect(events).toEqual([
      {
        type: 'metadata',
        routing: { routedComplexity: 'simple', routedThinkingBudget: 0 },
      },
    ])
  })
})

describe('stripSentinelBytes', () => {
  it('removes every framing sentinel and nothing else', () => {
    expect(
      stripSentinelBytes(`a${FRAME_TERMINATOR}b${END_OF_LEADING}c${TRAILER_SENTINEL}d`),
    ).toBe('abcd')
    expect(stripSentinelBytes('plain 🦩 text\nwith\tws')).toBe('plain 🦩 text\nwith\tws')
  })

  it('is idempotent and distributes over concatenation (safe per-delta OR on an accumulator)', () => {
    const a = `head${TRAILER_SENTINEL}`
    const b = `${FRAME_TERMINATOR}tail`
    expect(stripSentinelBytes(stripSentinelBytes(a))).toBe(stripSentinelBytes(a))
    expect(stripSentinelBytes(a + b)).toBe(stripSentinelBytes(a) + stripSentinelBytes(b))
  })

  it('is the SAME strip `encodeTextDelta` applies (one regex, two call sites)', () => {
    const hostile = `x${FRAME_TERMINATOR}y${END_OF_LEADING}z${TRAILER_SENTINEL}!`
    expect(new TextDecoder().decode(encodeTextDelta(hostile))).toBe(stripSentinelBytes(hostile))
  })
})

describe('encoders', () => {
  it('encodeTextDelta strips ALL sentinel bytes so hostile answer text round-trips clean', () => {
    const hostile = `has-nul[${FRAME_TERMINATOR}]rs[${END_OF_LEADING}]us[${TRAILER_SENTINEL}]end`
    const events = decodeAll([
      encodeLeadingFrame({ status: 'thinking' }),
      encodeEndOfLeading(),
      encodeTextDelta(hostile),
      encodeTrailingUsageFrame(TRAILER),
    ])
    const text = events
      .filter((e): e is Extract<ChatStreamEvent, { type: 'text-delta' }> => e.type === 'text-delta')
      .map((e) => e.text)
      .join('')
    // Sentinels removed — no mis-framing, trailer still parsed.
    expect(text).toBe('has-nul[]rs[]us[]end')
    expect(events.map((e) => e.type)).toEqual(['status', 'turn-start', 'text-delta', 'usage'])
  })

  it('round-trips every leading frame type through encode → decode', () => {
    const cases: Array<{ frame: Parameters<typeof encodeLeadingFrame>[0]; expected: ChatStreamEvent }> = [
      { frame: { status: 'thinking' }, expected: { type: 'status', phase: 'thinking' } },
      {
        frame: { kind: 'thinking-delta', text: 'slice' },
        expected: { type: 'thinking-delta', text: 'slice' },
      },
      {
        frame: {
          kind: 'routing',
          routedComplexity: 'complex',
          routedModel: 'claude-sonnet-x',
          routedThinkingBudget: 1024,
        },
        expected: {
          type: 'metadata',
          routing: {
            routedComplexity: 'complex',
            routedModel: 'claude-sonnet-x',
            routedThinkingBudget: 1024,
          },
        },
      },
      {
        frame: { kind: 'usage', stage: 'start', input_tokens: 7, cache_read_input_tokens: 3 },
        expected: {
          type: 'usage',
          stage: 'start',
          input_tokens: 7,
          cache_read_input_tokens: 3,
          cache_creation_input_tokens: undefined,
        },
      },
      {
        frame: { kind: 'text-leading', text: 'preamble' },
        expected: { type: 'text-delta', text: 'preamble', leading: true },
      },
      {
        frame: { kind: 'tool_error', toolName: 't', message: 'boom' },
        expected: { type: 'error', title: 'boom' },
      },
      {
        frame: {
          kind: 'approval_request',
          proposalId: 'p1',
          toolName: 'create_ticket',
          fields: [{ label: 'A', value: 'B' }],
        },
        expected: {
          type: 'approval-request',
          requestId: 'p1',
          approvalType: 'create_ticket',
          // No title → headline falls back to the tool name.
          command: 'create_ticket',
          fields: [{ label: 'A', value: 'B' }],
          status: 'pending',
        },
      },
      {
        frame: {
          kind: 'decision_resolved',
          proposalId: 'p1',
          ok: false,
          action: 'rejected',
          willAutoContinue: false,
        },
        expected: {
          type: 'approval-resolved',
          status: 'rejected',
          ok: false,
          willAutoContinue: false,
          requestId: 'p1',
        },
      },
      {
        frame: { modelLabel: 'Claude Sonnet', provider: 'anthropic', contextWindowMaxTokens: 200000 },
        expected: {
          type: 'metadata',
          sources: undefined,
          refs: undefined,
          provider: 'anthropic',
          modelLabel: 'Claude Sonnet',
          modelName: undefined,
          contextWindowMaxTokens: 200000,
          scrollAnchor: undefined,
        },
      },
    ]
    for (const { frame, expected } of cases) {
      const events = decodeAll([encodeLeadingFrame(frame)])
      expect(events, JSON.stringify(frame)).toEqual([expected])
    }
  })

  it('round-trips the trailing usage frame', () => {
    const events = decodeAll([
      encodeEndOfLeading(),
      encodeTextDelta('body'),
      encodeTrailingUsageFrame(TRAILER),
    ])
    expect(events[events.length - 1]).toMatchObject({
      type: 'usage',
      stage: 'end',
      input_tokens: 1234,
      output_tokens: 56,
      hit_rate_pct: 81.5,
    })
  })
})

describe('decodeNatsChunk', () => {
  it('lifts streamSeq into the seq envelope', () => {
    expect(decodeNatsChunk({ type: 'TEXT', text: 'hi', streamSeq: 42 })).toEqual({
      type: 'text-delta',
      text: 'hi',
      seq: 42,
    })
    expect(decodeNatsChunk({ type: 'MESSAGE_START' })).toEqual({ type: 'turn-start' })
    expect(decodeNatsChunk({ type: 'MESSAGE_END', streamSeq: 9 })).toEqual({
      type: 'turn-end',
      seq: 9,
    })
  })

  it('maps metadata, approval batch, approval result, token usage, compaction', () => {
    expect(
      decodeNatsChunk({
        type: 'AI_METADATA',
        modelName: 'gpt-x',
        modelDisplayName: 'GPT X',
        providerName: 'openai',
        contextWindow: 128000,
      }),
    ).toEqual({
      type: 'metadata',
      modelLabel: 'GPT X',
      modelName: 'gpt-x',
      provider: 'openai',
      contextWindowMaxTokens: 128000,
    })

    expect(
      decodeNatsChunk({
        type: 'APPROVAL_REQUEST',
        approvalRequestId: 'req-1',
        approvalType: 'ADMIN',
        toolCalls: [
          { toolExecutionRequestId: 'e1', toolName: 'run', requiresApproval: true },
          'garbage-row',
        ],
      }),
    ).toEqual({
      type: 'approval-request',
      requestId: 'req-1',
      approvalType: 'ADMIN',
      toolCalls: [
        {
          toolExecutionRequestId: 'e1',
          toolName: 'run',
          toolTitle: undefined,
          toolExplanation: undefined,
          toolType: undefined,
          requiresApproval: true,
          approvalType: null,
          toolCallArguments: null,
        },
      ],
    })

    expect(
      decodeNatsChunk({
        type: 'APPROVAL_RESULT',
        approvalRequestId: 'req-1',
        approved: true,
        displayName: 'Michael',
      }),
    ).toEqual({
      type: 'approval-resolved',
      requestId: 'req-1',
      status: 'approved',
      approvalType: 'CLIENT',
      resolvedByName: 'Michael',
    })

    expect(
      decodeNatsChunk({ type: 'TOKEN_USAGE', inputTokensSize: 1, outputTokensSize: 2 }),
    ).toEqual({
      type: 'token-usage',
      inputTokensSize: 1,
      outputTokensSize: 2,
      totalTokensSize: 0,
      contextSize: 0,
    })

    expect(decodeNatsChunk({ type: 'CONTEXT_COMPACTION_START' })).toEqual({
      type: 'compaction',
      phase: 'start',
    })
    expect(decodeNatsChunk({ type: 'CONTEXT_COMPACTION_END', text: 'sum' })).toEqual({
      type: 'compaction',
      phase: 'end',
      summary: 'sum',
    })
  })

  it('returns null for unknown or malformed chunks', () => {
    expect(decodeNatsChunk(null)).toBeNull()
    expect(decodeNatsChunk('nope')).toBeNull()
    expect(decodeNatsChunk({ type: 'SOMETHING_ELSE' })).toBeNull()
    expect(decodeNatsChunk({ type: 'TEXT' })).toBeNull()
    expect(decodeNatsChunk({ type: 'AI_METADATA', modelName: 'x' })).toBeNull()
  })
})

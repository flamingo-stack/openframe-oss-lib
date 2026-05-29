import { describe, expect, it } from 'vitest'
import { readLeadingDecisionFrame } from '../sse-decision-frame'

/** Build a `Response` whose body streams the given chunks back to the
 *  reader one tick at a time. Mirrors the way the chat-agent route
 *  emits frames over time. */
function streamingResponse(chunks: Uint8Array[]): Response {
  const encoder = new TextEncoder()
  void encoder // not strictly used; kept to mirror call site idiom
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk)
        // Yield so the consumer's read loop interleaves the chunks
        // realistically (the loop awaits between reads).
        await Promise.resolve()
      }
      controller.close()
    },
  })
  return new Response(body)
}

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

describe('readLeadingDecisionFrame', () => {
  it('returns the decision_resolved frame on a happy single-frame stream', async () => {
    const frame = {
      kind: 'decision_resolved',
      ok: true,
      action: 'approved',
      toolName: 'create_ticket',
      result: { ticket_id: '42', status: 'OPEN' },
    }
    const wire = bytes(JSON.stringify(frame) + '\0')
    const result = await readLeadingDecisionFrame(streamingResponse([wire]))
    expect(result.kind).toBe('decision_resolved')
    expect(result.ok).toBe(true)
    expect(result.action).toBe('approved')
    expect(result.toolName).toBe('create_ticket')
    expect(result.result?.ticket_id).toBe('42')
  })

  it('handles a rejected action', async () => {
    const frame = { kind: 'decision_resolved', ok: true, action: 'rejected' }
    const wire = bytes(JSON.stringify(frame) + '\0')
    const result = await readLeadingDecisionFrame(streamingResponse([wire]))
    expect(result.action).toBe('rejected')
  })

  it('drains the stream defensively when extra bytes arrive after the frame', async () => {
    const frame = { kind: 'decision_resolved', ok: true, action: 'approved' }
    const trailing = 'unexpected trailing bytes from a misbehaving server'
    const wire = bytes(JSON.stringify(frame) + '\0' + trailing)
    const result = await readLeadingDecisionFrame(streamingResponse([wire]))
    expect(result.action).toBe('approved')
    // No throw — the helper swallowed the trailing bytes.
  })

  it('rejects when the body is empty', async () => {
    const empty = streamingResponse([])
    await expect(readLeadingDecisionFrame(empty)).rejects.toThrow(/closed before leading frame/i)
  })

  it('rejects when the first frame has the wrong kind', async () => {
    const frame = { kind: 'approval_request', proposalId: 'x' }
    const wire = bytes(JSON.stringify(frame) + '\0')
    await expect(readLeadingDecisionFrame(streamingResponse([wire]))).rejects.toThrow(
      /expected decision_resolved/i,
    )
  })

  it('rejects when the leading JSON is malformed', async () => {
    const wire = bytes('not-json{\0')
    await expect(readLeadingDecisionFrame(streamingResponse([wire]))).rejects.toThrow(
      /leading JSON parse failed/i,
    )
  })

  it('rejects when the text-body sentinel arrives before any frame', async () => {
    const wire = bytes('\x1Ehello')
    await expect(readLeadingDecisionFrame(streamingResponse([wire]))).rejects.toThrow(
      /text-body sentinel arrived before leading frame/i,
    )
  })

  it('rejects when the response has no body', async () => {
    const bodiless = new Response(null, { status: 204 })
    await expect(readLeadingDecisionFrame(bodiless)).rejects.toThrow(/response has no body/i)
  })

  it('handles a frame split across multiple chunks', async () => {
    const frame = {
      kind: 'decision_resolved',
      ok: true,
      action: 'approved',
      result: { ticket_id: '99', mirror_synced: false },
    }
    const text = JSON.stringify(frame) + '\0'
    // Split mid-JSON to simulate a network chunk boundary in the middle
    // of the payload.
    const split = Math.floor(text.length / 2)
    const result = await readLeadingDecisionFrame(
      streamingResponse([bytes(text.slice(0, split)), bytes(text.slice(split))]),
    )
    expect(result.result?.ticket_id).toBe('99')
    expect(result.result?.mirror_synced).toBe(false)
  })

  it('preserves all envelope fields the chat-agent route emits', async () => {
    const frame = {
      kind: 'decision_resolved',
      ok: true,
      action: 'approved',
      toolName: 'update_ticket',
      willAutoContinue: false,
      proposalId: 'prop-123',
      result: { ticket_id: 'tkt-7', status: 'CLOSED' },
      card: { type: 'ticket', marker: 'm1', ref: { id: 'tkt-7' } },
      receiptText: 'Ticket closed.',
    }
    const wire = bytes(JSON.stringify(frame) + '\0')
    const result = await readLeadingDecisionFrame(streamingResponse([wire]))
    expect(result.toolName).toBe('update_ticket')
    expect(result.proposalId).toBe('prop-123')
    expect(result.card?.marker).toBe('m1')
    expect(result.receiptText).toBe('Ticket closed.')
  })
})

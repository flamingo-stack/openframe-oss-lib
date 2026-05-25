'use client'

/**
 * Shared decoder for the `decision_resolved` leading frame the
 * `confirm-tool` route emits as the first chunk of its SSE response.
 *
 * Wire format (matches `use-embedded-chat.ts:270-394`):
 *   - Frames are JSON objects separated by `\0` (NUL).
 *   - `\x1E` (record separator) marks the transition from leading
 *     metadata frames into the text body (chat path).
 *   - For the tickets-UI path, the request body carries `messages: []`
 *     which makes phase-2 (text body) structurally unreachable —
 *     `confirm-tool/route.ts:569` skips the `runDocsChat` call. So the
 *     stream contains exactly ONE frame (`decision_resolved`) followed
 *     by EOF.
 *
 * This helper drains the stream defensively (reads all remaining bytes
 * after the leading frame so the server-side `composed.start()` doesn't
 * hang on a half-closed connection) and returns the first decoded
 * `decision_resolved` frame. Throws on:
 *   - Empty body
 *   - First frame is not `decision_resolved`
 *   - Malformed JSON before the first `\0`
 *
 * Migration note: `use-embedded-chat.ts` still inlines the full decoder
 * including phase-2 text + trailing usage parsing. A future refactor
 * could move the leading-frame loop here and have the chat shell
 * compose with that — out of scope for this PR.
 */

export interface DecisionResolvedFrame {
  kind: 'decision_resolved'
  ok: boolean
  action: 'approved' | 'rejected'
  toolName?: string
  willAutoContinue?: boolean
  proposalId?: string
  /** Approve-path result envelope. `mirror_synced=false` means the
   *  HubSpot REST call succeeded but the local mirror upsert lagged —
   *  callers should optimistic-render and schedule a delayed refetch. */
  result?: {
    ticket_id?: string
    status?: string | null
    mirror_synced?: boolean
  } | null
  card?: {
    type?: string
    marker?: string
    ref?: unknown
  } | null
  receiptText?: string
}

/**
 * Read the leading `decision_resolved` frame from a confirm-tool SSE
 * response. Drains the stream to end-of-file before resolving so the
 * server doesn't sit on a half-closed socket.
 *
 * @throws {Error} when the body is empty, the first frame is not
 *   `decision_resolved`, or the leading JSON is malformed.
 */
export async function readLeadingDecisionFrame(
  response: Response,
): Promise<DecisionResolvedFrame> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('readLeadingDecisionFrame: response has no body')

  const decoder = new TextDecoder()
  let buffer = ''
  let frame: DecisionResolvedFrame | null = null

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // Try to extract the leading frame ASAP — we only need the first
      // chunk that contains a `\0`. Everything after is either phase-2
      // text (unexpected for tickets-UI but tolerated) or end-of-stream.
      if (frame === null) {
        const nullIdx = buffer.indexOf('\0')
        const recIdx = buffer.indexOf('\x1E')
        // If `\x1E` (text-body marker) shows up before `\0`, the server
        // emitted phase-2 without a leading frame — protocol violation.
        if (recIdx !== -1 && (nullIdx === -1 || recIdx < nullIdx)) {
          throw new Error(
            'readLeadingDecisionFrame: text-body sentinel arrived before leading frame',
          )
        }
        if (nullIdx !== -1) {
          const raw = buffer.slice(0, nullIdx)
          let parsed: unknown
          try {
            parsed = JSON.parse(raw)
          } catch (err) {
            throw new Error(
              `readLeadingDecisionFrame: leading JSON parse failed: ${(err as Error).message}`,
            )
          }
          const obj = parsed as Record<string, unknown>
          if (obj?.kind !== 'decision_resolved') {
            throw new Error(
              `readLeadingDecisionFrame: expected decision_resolved, got kind=${String(obj?.kind)}`,
            )
          }
          frame = normalizeDecisionFrame(obj)
          // Continue draining so the server-side stream closes cleanly.
          buffer = buffer.slice(nullIdx + 1)
        }
      }
      // Past the leading frame: just consume + discard the remainder.
      // Don't allocate a parser for phase-2 text; the tickets-UI path
      // is supposed to be a single frame.
    }
  } finally {
    // Release the lock even if we threw mid-loop.
    try {
      reader.releaseLock()
    } catch {
      // No-op: reader may already be released if the stream ended cleanly.
    }
  }

  if (frame === null) {
    throw new Error('readLeadingDecisionFrame: stream closed before leading frame arrived')
  }
  return frame
}

function normalizeDecisionFrame(obj: Record<string, unknown>): DecisionResolvedFrame {
  const action = obj.action === 'rejected' ? 'rejected' : 'approved'
  const result = (obj.result ?? null) as DecisionResolvedFrame['result']
  const card = (obj.card ?? null) as DecisionResolvedFrame['card']
  return {
    kind: 'decision_resolved',
    ok: obj.ok === true,
    action,
    ...(typeof obj.toolName === 'string' ? { toolName: obj.toolName } : {}),
    ...(obj.willAutoContinue === true ? { willAutoContinue: true } : {}),
    ...(typeof obj.proposalId === 'string' ? { proposalId: obj.proposalId } : {}),
    ...(result ? { result } : {}),
    ...(card ? { card } : {}),
    ...(typeof obj.receiptText === 'string' ? { receiptText: obj.receiptText } : {}),
  }
}

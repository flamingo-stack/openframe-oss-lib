/**
 * SSE wire-protocol decoder — a timer-free synchronous state machine,
 * mechanically extracted from `useSseChatAdapter`'s inline
 * `createDocStreamFn` parser. Byte-for-byte behavior parity with the
 * legacy parser is the contract (the golden fixtures in
 * `src/components/chat/hooks/__tests__/sse-stream-golden.test.ts` pin it
 * through the full hook path), including its quirks:
 *
 *   - A leading `\0`-terminated block that fails JSON.parse flips the
 *     stream into text mode and the WHOLE buffer (including the `\0`)
 *     is emitted as answer text (legacy no-frame stream fallback). This
 *     transition is marked `turn-start { implicit: true }`.
 *   - In text mode only `\x1F` is scanned — literal `\0` / `\x1E` bytes
 *     pass through into the answer; the FIRST literal `\x1F` flips into
 *     trailer mode and everything after is captured as the trailer
 *     (golden fixture (d) characterizes this mis-framing; the fix lives
 *     in `encode.ts`'s sentinel stripping, NOT here).
 *   - The `\x1E` sentinel and the `\x1F` trailer can arrive in ONE TCP
 *     chunk (fixed-answer responses) — the post-sentinel slice is
 *     re-scanned for the trailer sentinel.
 *   - Multi-byte UTF-8 across chunk boundaries survives via a single
 *     streaming TextDecoder (`{ stream: true }` on every push; no final
 *     flush — a trailing partial code point is dropped, as legacy did).
 *   - `end()` parses the accumulated trailer (malformed → silently
 *     ignored) and drops any un-terminated leading buffer, as legacy did.
 *     It is IDEMPOTENT (a deliberate deviation from legacy): repeat calls
 *     emit nothing, so an adapter that ends in both its completion path
 *     and its `finally` cannot double-count the usage frame.
 *
 * State flow: leading → (sentinel | parse-failure) → text → (\x1F) →
 * trailer-accumulate → end().
 *
 * Server-safe: no React, no timers, TextDecoder only.
 */

import { FRAME_TERMINATOR, END_OF_LEADING, TRAILER_SENTINEL } from './frames'
import type { ChatStreamEvent } from './events'

export interface SseFrameDecoder {
  /** Feed raw response bytes; returns the events they produced. */
  push(bytes: Uint8Array): ChatStreamEvent[]
  /**
   * Signal end-of-stream; parses the trailing usage frame if present.
   * IDEMPOTENT — every call after the first returns `[]`. Adapters
   * routinely call this from BOTH their completion path and a `finally`,
   * and a re-emitted `usage`/`stage:'end'` event would double-count token
   * usage (displayed cost doubles).
   */
  end(): ChatStreamEvent[]
}

/**
 * Escape `<` so markdown renderers that pass HTML through (rehypeRaw)
 * don't treat XML-like tokens in Claude's thinking output as elements.
 * `<` → `&lt;` preserves the visible character without breaking
 * blockquote `>` markers. Per-character, so it distributes over
 * concatenation: escape(a + b) === escape(a) + escape(b) — callers may
 * apply it per-delta or on the accumulated string interchangeably.
 */
export function escapeThinkingTags(text: string): string {
  return text.replace(/</g, '&lt;')
}

/**
 * Map one parsed leading frame to normalized events, replicating the
 * legacy parser's else-if chain ORDER and its exact truthiness/typeof
 * gates. Frames that matched a branch but failed its inner validation
 * (e.g. `routing` without a string `routedComplexity`) produce NO event,
 * exactly like the legacy no-op.
 */
function mapLeadingFrame(meta: any, out: ChatStreamEvent[]): void {
  if (meta.status === 'thinking') {
    out.push({ type: 'status', phase: 'thinking' })
  } else if (meta.kind === 'thinking-delta' && typeof meta.text === 'string') {
    // Wire is ALREADY delta — emit verbatim, append-only contract.
    out.push({ type: 'thinking-delta', text: meta.text })
  } else if (meta.kind === 'usage' && meta.stage === 'start') {
    out.push({
      type: 'usage',
      stage: 'start',
      input_tokens: meta.input_tokens,
      cache_read_input_tokens: meta.cache_read_input_tokens,
      cache_creation_input_tokens: meta.cache_creation_input_tokens,
    })
  } else if (meta.kind === 'decision_resolved' && typeof meta.action === 'string') {
    const status = meta.action === 'rejected' ? 'rejected' : 'approved'
    const toolName = typeof meta.tool_name === 'string' ? meta.tool_name : undefined
    const result = meta.result ?? null
    const card = meta.card ?? null
    out.push({
      type: 'approval-resolved',
      status,
      ok: meta.ok === true,
      willAutoContinue: meta.willAutoContinue === true,
      ...(toolName ? { toolName } : {}),
      ...(result ? { result } : {}),
      ...(card?.marker ? { marker: card.marker } : {}),
      ...(card?.ref ? { cardRef: card.ref } : {}),
      ...(card?.type ? { cardType: card.type } : {}),
      ...(typeof meta.receiptText === 'string' ? { receiptText: meta.receiptText } : {}),
      requestId: typeof meta.proposalId === 'string' ? meta.proposalId : undefined,
    })
  } else if (meta.kind === 'approval_request' && meta.proposalId) {
    const proposalId = String(meta.proposalId)
    const toolName = String(meta.toolName ?? 'tool')
    const headline =
      typeof meta.title === 'string' && meta.title.length > 0 ? meta.title : toolName
    const rawFields = Array.isArray(meta.fields)
      ? (meta.fields as Array<{ label?: string; value?: string }>)
      : []
    const fields: Array<{ label: string; value: string }> = []
    for (const f of rawFields) {
      if (!f || !f.label || !f.value) continue
      fields.push({ label: f.label, value: f.value })
    }
    out.push({
      type: 'approval-request',
      requestId: proposalId,
      approvalType: toolName,
      command: headline,
      fields,
      status: 'pending',
    })
  } else if (meta.kind === 'text-leading' && typeof meta.text === 'string') {
    out.push({ type: 'text-delta', text: meta.text, leading: true })
  } else if (meta.kind === 'tool_error') {
    const msg =
      typeof meta.message === 'string' && meta.message.length > 0
        ? meta.message
        : 'Could not complete the requested action right now.'
    out.push({ type: 'error', title: msg })
  } else if (meta.kind === 'routing') {
    if (typeof meta.routedComplexity === 'string') {
      out.push({
        type: 'metadata',
        routing: {
          routedComplexity: meta.routedComplexity,
          ...(typeof meta.routedModel === 'string' ? { routedModel: meta.routedModel } : {}),
          routedThinkingBudget:
            typeof meta.routedThinkingBudget === 'number' ? meta.routedThinkingBudget : null,
        },
      })
    }
  } else {
    // Catch-all metadata-ish frame. Raw values pass through UNVALIDATED
    // (possibly undefined) so the consumer can replicate the legacy
    // presence/truthiness gates exactly — including the `model`-presence
    // trigger whose value is never stored.
    out.push({
      type: 'metadata',
      sources: meta.sources,
      refs: meta.refs,
      provider: meta.provider,
      modelLabel: meta.modelLabel,
      modelName: meta.model,
      contextWindowMaxTokens: meta.contextWindowMaxTokens,
      scrollAnchor: meta.scrollAnchor,
    })
  }
}

export function createSseFrameDecoder(): SseFrameDecoder {
  const textDecoder = new TextDecoder()
  let buffer = ''
  let inText = false
  let inTrailer = false
  let trailerBuffer = ''
  let ended = false

  function push(bytes: Uint8Array): ChatStreamEvent[] {
    const out: ChatStreamEvent[] = []
    const chunk = textDecoder.decode(bytes, { stream: true })

    if (!inText) {
      buffer += chunk
      while (!inText) {
        const recIdx = buffer.indexOf(END_OF_LEADING)
        const nullIdx = buffer.indexOf(FRAME_TERMINATOR)
        if (recIdx !== -1 && (nullIdx === -1 || recIdx < nullIdx)) {
          inText = true
          out.push({ type: 'turn-start' })
          const after = buffer.slice(recIdx + 1)
          buffer = ''
          if (after) {
            // The `after` slice may ALSO contain the `\x1F` trailing-
            // usage sentinel — common for fixed-answer responses where
            // the whole frame sequence arrives in ONE TCP chunk.
            const unitIdx = after.indexOf(TRAILER_SENTINEL)
            if (unitIdx === -1) {
              out.push({ type: 'text-delta', text: after })
            } else {
              const textBefore = after.slice(0, unitIdx)
              const trailerAfter = after.slice(unitIdx + 1)
              if (textBefore) {
                out.push({ type: 'text-delta', text: textBefore })
              }
              inTrailer = true
              trailerBuffer = trailerAfter
            }
          }
          break
        }
        if (nullIdx === -1) break // need more bytes
        const metaStr = buffer.slice(0, nullIdx)
        const remaining = buffer.slice(nullIdx + 1)
        let meta: any
        try {
          meta = JSON.parse(metaStr)
        } catch {
          // Not JSON — start of answer body. The WHOLE buffer (including
          // the `\0`) becomes answer text; `implicit` tells consumers
          // this was the fallback path, not the `\x1E` sentinel.
          inText = true
          out.push({ type: 'turn-start', implicit: true })
          if (buffer.length > 0) {
            out.push({ type: 'text-delta', text: buffer })
            buffer = ''
          }
          break
        }
        mapLeadingFrame(meta, out)
        buffer = remaining
      }
    } else if (inTrailer) {
      trailerBuffer += chunk
    } else {
      // Text mode: only the `\x1F` trailer sentinel is scanned. The
      // unconditional emit (even for an empty decode of a partial
      // multi-byte code point) mirrors the legacy per-chunk yield.
      const sepIdx = chunk.indexOf(TRAILER_SENTINEL)
      if (sepIdx === -1) {
        out.push({ type: 'text-delta', text: chunk })
      } else {
        const before = chunk.slice(0, sepIdx)
        const after = chunk.slice(sepIdx + 1)
        if (before) out.push({ type: 'text-delta', text: before })
        inTrailer = true
        trailerBuffer = after
      }
    }
    return out
  }

  function end(): ChatStreamEvent[] {
    // Idempotency guard: a second end() must emit NOTHING. The trailer is
    // also cleared so no later push()/end() pair can replay it.
    if (ended) return []
    ended = true
    const out: ChatStreamEvent[] = []
    if (trailerBuffer.length > 0) {
      const raw = trailerBuffer
      trailerBuffer = ''
      try {
        const meta = JSON.parse(raw)
        if (meta.kind === 'usage' && (meta.stage === 'end' || meta.stage === 'display')) {
          out.push({
            type: 'usage',
            stage: 'end',
            input_tokens: meta.input_tokens,
            output_tokens: meta.output_tokens,
            cache_read_input_tokens: meta.cache_read_input_tokens,
            cache_creation_input_tokens: meta.cache_creation_input_tokens,
            hit_rate_pct: meta.hit_rate_pct,
            telemetry: meta.telemetry,
            breakdown: meta.breakdown,
            debug: meta.debug,
          })
        }
      } catch {
        // Malformed trailer — silently ignore (legacy parity).
      }
    }
    return out
  }

  return { push, end }
}

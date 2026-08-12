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
// The frame table is SHARED with the NATS decoder — guide answers re-stream the
// hub's frames verbatim inside `GUIDE` chunks — so it lives in its own module.
import { mapLeadingFrame } from './leading-frames'

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

// `escapeThinkingTags` moved to `./leading-frames` alongside the frame table,
// and is re-exported here: consumers have imported it from this module since it
// was written, and the `chat-protocol` barrel re-exports it from here.
export { escapeThinkingTags } from './leading-frames'

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

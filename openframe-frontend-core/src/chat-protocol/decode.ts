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

import type { ChatStreamEvent } from './events';
import type { UsageTelemetry } from './frames';
import { FRAME_TERMINATOR, END_OF_LEADING, TRAILER_SENTINEL } from './frames';
// The frame table lives in its own module so it is reusable outside this
// decoder. `frameNum` comes from there too: the trailing usage frame's token
// counts must pass the SAME typeof gate the leading `usage:start` frame's do.
import { mapLeadingFrame, frameNum } from './leading-frames';

export interface SseFrameDecoder {
  /** Feed raw response bytes; returns the events they produced. */
  push(bytes: Uint8Array): ChatStreamEvent[];
  /**
   * Signal end-of-stream; parses the trailing usage frame if present.
   * IDEMPOTENT — every call after the first returns `[]`. Adapters
   * routinely call this from BOTH their completion path and a `finally`,
   * and a re-emitted `usage`/`stage:'end'` event would double-count token
   * usage (displayed cost doubles).
   */
  end(): ChatStreamEvent[];
}

// `escapeThinkingTags` moved to `./leading-frames` alongside the frame table,
// and is re-exported here: consumers have imported it from this module since it
// was written, and the `chat-protocol` barrel re-exports it from here.
export { escapeThinkingTags } from './leading-frames';

/** Narrow a parsed leading frame to something the frame table can read. */
function isFrameObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Narrow the trailer's `telemetry` blob to a real {@link UsageTelemetry}.
 *
 * Every field of that interface is a REQUIRED `number`, so a frame carrying a
 * partial blob (or non-numeric counts) is not one — passing it through would
 * hand consumers `undefined` where the type promises a number, the same shape
 * of lie that NaN'd the `breakdown.haiku*` sums. A blob that fails the gate is
 * dropped, matching this decoder's "malformed trailer → silently ignored"
 * contract; nothing downstream distinguishes absent from malformed.
 */
function frameTelemetry(value: unknown): UsageTelemetry | undefined {
  if (!isFrameObject(value)) return undefined;
  const { cards, chips, sentences, answerLen } = value;
  if (
    typeof cards !== 'number' ||
    typeof chips !== 'number' ||
    typeof sentences !== 'number' ||
    typeof answerLen !== 'number'
  ) {
    return undefined;
  }
  return { cards, chips, sentences, answerLen };
}

export function createSseFrameDecoder(): SseFrameDecoder {
  const textDecoder = new TextDecoder();
  let buffer = '';
  let inText = false;
  let inTrailer = false;
  let trailerBuffer = '';
  let ended = false;

  function push(bytes: Uint8Array): ChatStreamEvent[] {
    const out: ChatStreamEvent[] = [];
    const chunk = textDecoder.decode(bytes, { stream: true });

    if (!inText) {
      buffer += chunk;
      while (!inText) {
        const recIdx = buffer.indexOf(END_OF_LEADING);
        const nullIdx = buffer.indexOf(FRAME_TERMINATOR);
        if (recIdx !== -1 && (nullIdx === -1 || recIdx < nullIdx)) {
          inText = true;
          out.push({ type: 'turn-start' });
          const after = buffer.slice(recIdx + 1);
          buffer = '';
          if (after) {
            // The `after` slice may ALSO contain the `\x1F` trailing-
            // usage sentinel — common for fixed-answer responses where
            // the whole frame sequence arrives in ONE TCP chunk.
            const unitIdx = after.indexOf(TRAILER_SENTINEL);
            if (unitIdx === -1) {
              out.push({ type: 'text-delta', text: after });
            } else {
              const textBefore = after.slice(0, unitIdx);
              const trailerAfter = after.slice(unitIdx + 1);
              if (textBefore) {
                out.push({ type: 'text-delta', text: textBefore });
              }
              inTrailer = true;
              trailerBuffer = trailerAfter;
            }
          }
          break;
        }
        if (nullIdx === -1) break; // need more bytes
        const metaStr = buffer.slice(0, nullIdx);
        const remaining = buffer.slice(nullIdx + 1);
        let meta: unknown;
        try {
          meta = JSON.parse(metaStr);
        } catch {
          // Not JSON — start of answer body. The WHOLE buffer (including
          // the `\0`) becomes answer text; `implicit` tells consumers
          // this was the fallback path, not the `\x1E` sentinel.
          inText = true;
          out.push({ type: 'turn-start', implicit: true });
          if (buffer.length > 0) {
            out.push({ type: 'text-delta', text: buffer });
            buffer = '';
          }
          break;
        }
        // A JSON scalar where a frame object was expected has no fields to
        // read, so it falls through the table's catch-all exactly as an empty
        // frame does — which is what the old `any` typing produced for every
        // `meta.<field>` lookup. (`null` used to THROW here instead.)
        mapLeadingFrame(isFrameObject(meta) ? meta : {}, out);
        buffer = remaining;
      }
    } else if (inTrailer) {
      trailerBuffer += chunk;
    } else {
      // Text mode: only the `\x1F` trailer sentinel is scanned. The
      // unconditional emit (even for an empty decode of a partial
      // multi-byte code point) mirrors the legacy per-chunk yield.
      const sepIdx = chunk.indexOf(TRAILER_SENTINEL);
      if (sepIdx === -1) {
        out.push({ type: 'text-delta', text: chunk });
      } else {
        const before = chunk.slice(0, sepIdx);
        const after = chunk.slice(sepIdx + 1);
        if (before) out.push({ type: 'text-delta', text: before });
        inTrailer = true;
        trailerBuffer = after;
      }
    }
    return out;
  }

  function end(): ChatStreamEvent[] {
    // Idempotency guard: a second end() must emit NOTHING. The trailer is
    // also cleared so no later push()/end() pair can replay it.
    if (ended) return [];
    ended = true;
    const out: ChatStreamEvent[] = [];
    if (trailerBuffer.length > 0) {
      const raw = trailerBuffer;
      trailerBuffer = '';
      try {
        // Off the wire this is `unknown`, NOT the frame shape it claims to be.
        // A JSON scalar (or `null`) reaches the `kind` read below as a non-
        // object and simply fails the gate — no throw, no event.
        const meta: unknown = JSON.parse(raw);
        if (isFrameObject(meta) && meta.kind === 'usage' && (meta.stage === 'end' || meta.stage === 'display')) {
          // Token counts pass `frameNum`, the SAME gate the leading
          // `usage:start` frame's counts already pass. Un-gated, a wire value
          // of the wrong type (a string count from a server that stringifies
          // big integers) landed in a `number` field and rode straight into
          // `applySseUsage`'s `event.input_tokens ?? null` — which only
          // null-checks — and on into the displayed token totals.
          out.push({
            type: 'usage',
            stage: 'end',
            input_tokens: frameNum(meta.input_tokens),
            output_tokens: frameNum(meta.output_tokens),
            cache_read_input_tokens: frameNum(meta.cache_read_input_tokens),
            cache_creation_input_tokens: frameNum(meta.cache_creation_input_tokens),
            hit_rate_pct: frameNum(meta.hit_rate_pct),
            telemetry: frameTelemetry(meta.telemetry),
            // `breakdown` and `debug` are declared `unknown` on UsageEvent on
            // purpose — `applySseUsage` re-validates every nested field — so
            // they pass through raw, exactly as before.
            breakdown: meta.breakdown,
            debug: meta.debug,
          });
        }
      } catch {
        // Malformed trailer — silently ignore (legacy parity).
      }
    }
    return out;
  }

  return { push, end };
}

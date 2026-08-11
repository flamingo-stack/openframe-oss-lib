/**
 * SSE wire-protocol encoders — the emit side of the framing contract in
 * `./frames.ts`. Server-safe (TextEncoder only). The hub's stream route
 * consumes these so emitter and decoder can never drift.
 */

import {
  FRAME_TERMINATOR,
  END_OF_LEADING,
  TRAILER_SENTINEL,
  type SseLeadingFrame,
  type SseTrailingUsageFrame,
} from './frames'

const encoder = new TextEncoder()

/** Matches every framing sentinel byte: `\0`, `\x1E`, `\x1F`. THE one
 *  regex — `stripSentinelBytes` is its only consumer. */
const SENTINEL_BYTES_RE = /[\u0000\u001E\u001F]/g

/**
 * Remove the SSE framing sentinel bytes (`\0`, `\x1E`, `\x1F`) from model
 * text. Exported as a STANDALONE helper — not just folded into
 * `encodeTextDelta` — because producers must strip at the point where they
 * first take custody of the text, BEFORE any local accumulation.
 *
 * Concretely: the hub's `claude-util.ts` accumulates `state.answerText` for
 * persistence + telemetry. If stripping only happened at encode time, the
 * persisted/telemetered answer would diverge, character for character, from
 * the bytes the user actually received whenever the model echoes a control
 * byte. Both sides call this, so there is exactly ONE definition of "which
 * bytes are framing" in the whole system — do not re-declare the regex.
 *
 * Idempotent and per-character, so it distributes over concatenation:
 * `strip(a + b) === strip(a) + strip(b)` — safe to apply per-delta or on the
 * accumulated string interchangeably.
 */
export function stripSentinelBytes(text: string): string {
  return text.replace(SENTINEL_BYTES_RE, '')
}

/** Encode one leading frame: JSON + `\0` terminator. */
export function encodeLeadingFrame(frame: SseLeadingFrame): Uint8Array {
  return encoder.encode(JSON.stringify(frame) + FRAME_TERMINATOR)
}

/** Encode the single `\x1E` end-of-leading-frames sentinel. */
export function encodeEndOfLeading(): Uint8Array {
  return encoder.encode(END_OF_LEADING)
}

/**
 * Encode a raw answer-text delta. STRIPS the framing sentinel bytes via
 * `stripSentinelBytes` so model-echoed control bytes can no longer
 * mis-frame the stream (a literal `\x1F` in the answer used to flip the
 * client into trailer mode and swallow the rest of the answer PLUS the real
 * usage trailer — characterized by golden fixture (d)). Forward-looking
 * encoder fix only; the decoder's behavior is unchanged.
 *
 * Producers that ALSO accumulate the text locally (persistence, telemetry)
 * must call `stripSentinelBytes` on their own copy — see its docblock.
 */
export function encodeTextDelta(text: string): Uint8Array {
  return encoder.encode(stripSentinelBytes(text))
}

/** Encode the trailing usage frame: `\x1F` + JSON, no terminator
 *  (runs to stream end). */
export function encodeTrailingUsageFrame(frame: SseTrailingUsageFrame): Uint8Array {
  return encoder.encode(TRAILER_SENTINEL + JSON.stringify(frame))
}

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

/** Matches every framing sentinel byte: `\0`, `\x1E`, `\x1F`. */
const SENTINEL_BYTES_RE = /[\u0000\u001E\u001F]/g

/** Encode one leading frame: JSON + `\0` terminator. */
export function encodeLeadingFrame(frame: SseLeadingFrame): Uint8Array {
  return encoder.encode(JSON.stringify(frame) + FRAME_TERMINATOR)
}

/** Encode the single `\x1E` end-of-leading-frames sentinel. */
export function encodeEndOfLeading(): Uint8Array {
  return encoder.encode(END_OF_LEADING)
}

/**
 * Encode a raw answer-text delta. STRIPS the framing sentinel bytes
 * (`\0`, `\x1E`, `\x1F`) from the text so model-echoed control bytes can
 * no longer mis-frame the stream (a literal `\x1F` in the answer used to
 * flip the client into trailer mode and swallow the rest of the answer
 * PLUS the real usage trailer — characterized by golden fixture (d)).
 * Forward-looking encoder fix only; the decoder's behavior is unchanged.
 */
export function encodeTextDelta(text: string): Uint8Array {
  return encoder.encode(text.replace(SENTINEL_BYTES_RE, ''))
}

/** Encode the trailing usage frame: `\x1F` + JSON, no terminator
 *  (runs to stream end). */
export function encodeTrailingUsageFrame(frame: SseTrailingUsageFrame): Uint8Array {
  return encoder.encode(TRAILER_SENTINEL + JSON.stringify(frame))
}

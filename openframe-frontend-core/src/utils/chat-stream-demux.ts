/*
 * Client-side demuxer for the v5.1 §7 chat stream protocol.
 *
 * Stream layout this demuxer handles:
 *
 *   PHASE 1 — leading metadata frames (0..N):
 *     <UTF-8 JSON>\0  (each terminated by a single NUL byte)
 *
 *   PHASE 2 — body (interleaved):
 *     TEXT  : raw UTF-8 bytes
 *     CTRL  : \xFE <u32-be length> <type byte> <JSON payload bytes>
 *
 * Phase 1 ends at the first \xFE byte (signals first ctrl frame OR start of
 * a body that contains ctrl frames). Phase 1 is also implicitly over when
 * the buffer transitions from \0-terminated JSON frames into non-JSON
 * text — handled by the JSON.parse fail path (falls through to phase 2).
 *
 * Why the OSS-lib needs this (separate from the hub's own use-docs.ts):
 * a future OSS-lib chat surface (or future hub migration) can route its
 * chat stream through this demuxer for clean separation between text and
 * ctrl frames. The hub's existing use-docs.ts uses a Session-1 protocol
 * (\x1E sentinel between leading frames and text; \x1F sentinel for
 * trailing usage) that pre-dates this spec — both are correct; pick the
 * one whose protocol matches the server you're consuming.
 *
 * Critical invariants enforced:
 *   - 1 MB cap on ctrl frame payload (DoS-resistant)
 *   - Unknown type bytes log + skip (forward-compat)
 *   - JSON.parse errors per-frame log + skip (no stream-kill)
 *   - Multi-byte UTF-8 codepoints preserved across chunk boundaries
 *     (no U+FFFD replacement artifacts on European/CJK text)
 *
 * v6.1 fix: payload size cap mirrors the server's MAX_CTRL_FRAME_BYTES
 * constant. Both sides enforce; neither trusts the other.
 */

/**
 * Must match `MAX_CTRL_FRAME_BYTES` in the server's
 * `lib/utils/sse-binary-framing.ts`. Hard-coded here instead of imported
 * so the OSS-lib has no dependency on hub-side modules. If the server
 * raises its cap, raise this one too AND ship the OSS-lib bump first
 * (clients with a stale cap reject the larger frame).
 */
export const MAX_CTRL_FRAME_BYTES = 1 * 1024 * 1024

/**
 * Discriminated union of events yielded by `demuxChatStream`. The kind
 * field tells the consumer how to interpret `data`:
 *   - 'text'           → string (decoded UTF-8 text)
 *   - 'metadata'       → object (parsed leading-frame JSON; e.g.,
 *                        sources/refs/model)
 *   - 'tool_proposal'  → { proposalId, toolName, args, toolUseId }
 *   - 'tool_result'    → { proposalId, result }
 *   - 'error'          → { message, code }
 *   - 'usage'          → token + cache + breakdown stats
 */
export interface DemuxedEvent {
  kind: 'text' | 'metadata' | 'tool_proposal' | 'tool_result' | 'error' | 'usage'
  data: string | Record<string, unknown>
}

/**
 * Drain a chat-stream reader, yielding each frame as a typed event.
 *
 * Usage:
 * ```ts
 * for await (const ev of demuxChatStream(response.body!.getReader())) {
 *   switch (ev.kind) {
 *     case 'metadata': handleMetadata(ev.data)
 *     case 'text':     appendToMessage(ev.data)
 *     ...
 *   }
 * }
 * ```
 *
 * The generator runs to completion (server closes the stream) OR to the
 * first unrecoverable framing error (oversized ctrl frame).
 */
export async function* demuxChatStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncIterableIterator<DemuxedEvent> {
  // TS 5.8+ tightened Uint8Array's generic to `<ArrayBuffer | SharedArrayBuffer>`
  // and `subarray` returns `<ArrayBufferLike>`. Type the buffer + helpers'
  // returns as `Uint8Array<ArrayBufferLike>` so reassignments between
  // freshly-allocated buffers and subarray slices type-check cleanly.
  let buffer: Uint8Array<ArrayBufferLike> = new Uint8Array(0)
  let phase: 'metadata' | 'body' = 'metadata'

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer = concat(buffer, value)

    // -----------------------------------------------------------------
    // PHASE 1 — drain leading \0-terminated metadata frames. Continues
    // until the buffer is exhausted OR a \xFE byte appears before the
    // next \0 (signals body phase has started — first byte is a ctrl
    // frame). Note: a leading metadata frame's payload is JSON, and
    // JSON.stringify NEVER emits raw 0xFE (it escapes non-ASCII as
    // \uXXXX), so 0xFE can only appear as the START of a ctrl frame.
    // -----------------------------------------------------------------
    while (phase === 'metadata' && buffer.byteLength > 0) {
      const feIdx = indexOfByte(buffer, 0xfe)
      const nullIdx = indexOfByte(buffer, 0x00)
      if (nullIdx === -1 && feIdx === -1) break // need more bytes
      // Body phase begins at the first 0xFE (a ctrl frame appeared
      // before the next \0-terminated metadata frame).
      if (feIdx !== -1 && (nullIdx === -1 || feIdx < nullIdx)) {
        phase = 'body'
        break
      }
      // Consume one metadata frame: bytes 0..nullIdx-1 are the JSON.
      try {
        const json = decodeText(buffer.subarray(0, nullIdx))
        // Empty frame (just a stray \0) — skip silently.
        if (json.trim().length > 0) {
          yield { kind: 'metadata', data: JSON.parse(json) }
        }
      } catch (err) {
        // Malformed JSON in a leading-frame slot. Most likely cause:
        // server emitted non-JSON text without a \xFE-prefixed ctrl
        // frame to switch us out of metadata phase. Treat the rest of
        // the buffer as body text and yield it.
        console.warn('[chat-stream-demux] failed to parse metadata frame; switching to body phase:', err)
        phase = 'body'
        // Don't consume the \0 — yield the entire buffer as text.
        break
      }
      buffer = buffer.subarray(nullIdx + 1)
    }
    if (phase === 'metadata') continue // not enough bytes yet for a phase decision

    // -----------------------------------------------------------------
    // PHASE 2 — body. Interleaved text and ctrl frames.
    // -----------------------------------------------------------------
    while (buffer.byteLength > 0) {
      const feIdx = indexOfByte(buffer, 0xfe)
      if (feIdx === -1) {
        // No ctrl frame ahead. Flush whole-codepoint prefix; retain
        // partial trailing UTF-8 bytes for the next chunk so multi-byte
        // codepoints split across TCP packets don't emit replacement chars.
        const { full, partial } = splitOnLastCodepoint(buffer)
        if (full.byteLength > 0) {
          yield { kind: 'text', data: decodeText(full) }
        }
        buffer = partial
        break // wait for more bytes
      }
      // Text before the ctrl frame — emit it. Preserve trailing-partial
      // codepoints only if the \xFE itself appeared MID-codepoint, which
      // is impossible (\xFE can't be a continuation byte either —
      // continuations are 0x80-0xBF). So the bytes 0..feIdx-1 are
      // guaranteed whole codepoints.
      if (feIdx > 0) {
        yield { kind: 'text', data: decodeText(buffer.subarray(0, feIdx)) }
      }
      // Frame header layout: \xFE (1) + u32-be length (4) + type (1) = 6 bytes
      if (buffer.byteLength < feIdx + 6) break // need more bytes for header
      const length = new DataView(buffer.buffer, buffer.byteOffset + feIdx + 1, 4).getUint32(0, false)
      const type = buffer[feIdx + 5]
      // Reject malformed / oversized frames eagerly. The server-side cap
      // is the same constant; this side enforces too because we don't
      // trust the server (compromise, version skew, etc.).
      if (length > MAX_CTRL_FRAME_BYTES) {
        console.error(
          `[chat-stream-demux] ctrl frame length ${length} exceeds cap ${MAX_CTRL_FRAME_BYTES}; aborting demux`,
        )
        return
      }
      const totalFrameBytes = 1 + 4 + 1 + length
      if (buffer.byteLength < feIdx + totalFrameBytes) break // need more bytes for payload
      const payloadBytes = buffer.subarray(feIdx + 6, feIdx + 6 + length)
      let payload: unknown
      try {
        payload = JSON.parse(decodeText(payloadBytes))
      } catch (err) {
        console.warn(`[chat-stream-demux] failed to parse ctrl frame type=0x${type.toString(16)}:`, err)
        buffer = buffer.subarray(feIdx + totalFrameBytes)
        continue
      }
      switch (type) {
        case 0x01:
          yield { kind: 'tool_proposal', data: payload as Record<string, unknown> }
          break
        case 0x02:
          yield { kind: 'tool_result', data: payload as Record<string, unknown> }
          break
        case 0x03:
          yield { kind: 'error', data: payload as Record<string, unknown> }
          break
        case 0x04:
          yield { kind: 'usage', data: payload as Record<string, unknown> }
          break
        default:
          // Unknown type byte — log and skip (don't crash). Lets the
          // server roll out new frame types without immediately bumping
          // every client.
          console.warn(
            `[chat-stream-demux] unknown ctrl frame type 0x${type.toString(16)} (length=${length}); skipped`,
          )
          break
      }
      buffer = buffer.subarray(feIdx + totalFrameBytes)
    }
  }
  // Final flush — server closed cleanly with bytes still in the buffer.
  // In body phase: yield whatever's left as text.
  // In metadata phase: this only happens if the stream emitted metadata
  // frames followed by a text body WITHOUT a ctrl frame to trigger phase
  // transition. The spec recommends emitting at least one ctrl frame (or
  // using a transport sentinel), but we treat trailing bytes as text
  // rather than silently discarding them — pragmatic forward-compat.
  if (buffer.byteLength > 0) {
    yield { kind: 'text', data: decodeText(buffer) }
  }
}

/**
 * UTF-8 decode helper. `fatal: false` means invalid sequences produce
 * U+FFFD replacement chars instead of throwing — chat text rendering
 * survives a corrupted byte without killing the whole stream.
 */
function decodeText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

/**
 * Split a Uint8Array into (whole-codepoint prefix, trailing partial bytes).
 *
 * UTF-8 codepoint structure:
 *   0xxxxxxx                                              → 1-byte ASCII
 *   110xxxxx 10xxxxxx                                     → 2 bytes
 *   1110xxxx 10xxxxxx 10xxxxxx                            → 3 bytes
 *   11110xxx 10xxxxxx 10xxxxxx 10xxxxxx                   → 4 bytes
 *
 * Continuation bytes match `(b & 0xC0) === 0x80` (0x80..0xBF).
 * Leading bytes match `(b & 0xC0) !== 0x80`. Walk back at most 4 bytes
 * to find the last leading byte; if its expected width exceeds what we
 * have, retain the partial tail for the next chunk.
 *
 * Without this, an emoji or CJK character split across a TCP chunk
 * boundary would emit replacement chars on the first chunk's text
 * frame and replacement chars on the second's prefix.
 */
function splitOnLastCodepoint(bytes: Uint8Array): { full: Uint8Array; partial: Uint8Array } {
  if (bytes.byteLength === 0) return { full: bytes, partial: bytes }
  for (let i = bytes.byteLength - 1; i >= Math.max(0, bytes.byteLength - 4); i--) {
    const b = bytes[i]
    if ((b & 0x80) === 0) {
      // Last byte is ASCII — buffer ends on a whole codepoint.
      return { full: bytes, partial: new Uint8Array(0) }
    }
    if ((b & 0xc0) !== 0x80) {
      // Leading byte. Width = number of leading 1s.
      const width = b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : 2
      if (i + width <= bytes.byteLength) {
        // Codepoint complete in the buffer.
        return { full: bytes, partial: new Uint8Array(0) }
      }
      // Codepoint truncated — retain the partial tail.
      return { full: bytes.subarray(0, i), partial: bytes.subarray(i) }
    }
    // Continuation byte — keep walking back to find the leading byte.
  }
  // Buffer has no leading byte in the last 4 bytes (either malformed or
  // pathologically long continuation run). Emit as-is; the decoder will
  // produce replacement chars where the input is genuinely bad.
  return { full: bytes, partial: new Uint8Array(0) }
}

/**
 * `Uint8Array.indexOf` exists on Node's TypedArray but isn't a real
 * Array method in the DOM lib types — `(bytes as any).indexOf(byte)`
 * works at runtime but trips strict TS. Helper preserves the typed
 * surface and matches Node's behavior (returns -1 if not found).
 */
function indexOfByte(bytes: Uint8Array, target: number): number {
  for (let i = 0; i < bytes.byteLength; i++) {
    if (bytes[i] === target) return i
  }
  return -1
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.byteLength === 0) return b
  if (b.byteLength === 0) return a
  const out = new Uint8Array(a.byteLength + b.byteLength)
  out.set(a, 0)
  out.set(b, a.byteLength)
  return out
}

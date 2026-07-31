/**
 * Scripted-conversation replay — turn a stored `HistoricalMessage[]` into ordered
 * "mock SSE" playback frames that animate a chat surface exactly like the live
 * NATS/SSE stream (a `thinking` pause → assistant text token-by-token → tool /
 * approval segments popping in → `idle`), just replayed from a script instead of
 * a network stream.
 *
 * Lives in the lib (not a host) so any consumer — marketing hero demos, docs,
 * onboarding tours — can drive a `previewMode` `EmbeddableChat` or a
 * `ChatMessageList` from a canned conversation without re-implementing the
 * streaming cadence. Pair with {@link useScriptedStream} (the playback clock).
 */

import type { HistoricalMessage, MessageData, StreamingPhase } from '../types'

/** Normalize the single-or-array `messageData` to an array (empty when absent). */
export function normalizeHistoricalMessageData(md: HistoricalMessage['messageData']): MessageData[] {
  return Array.isArray(md) ? md : md ? [md] : []
}

/** A message the user authored carries an `owner`; assistant turns have none —
 *  drives whether a turn streams (assistant) or lands at once (user). */
export function isHistoricalUserTurn(m: HistoricalMessage): boolean {
  return !!m.owner
}

const isTextSegment = (d: MessageData): d is MessageData & { type: 'TEXT'; text: string } =>
  (d as { type?: string })?.type === 'TEXT' && typeof (d as { text?: unknown }).text === 'string'

/** One rendered step of the mocked stream. */
export interface StreamFrame {
  /** The partial message list to show at this step. */
  messages: HistoricalMessage[]
  phase: StreamingPhase
  /** The chat "typing" indicator (up during the `thinking` pause). */
  typing: boolean
  /** Hold time (ms) before advancing to the next frame. */
  delayMs: number
}

// Playback cadence. Assistant turns "think" then stream token-by-token; user
// turns land at once. Tuned to read like a real chat without dragging.
const THINK_MS = 550
const TOKEN_MS = 55 // per word revealed while streaming text
const USER_MS = 480 // dwell on a user turn before the reply starts thinking
const SEGMENT_MS = 340 // a tool / approval card pops in
const POST_MS = 240 // dwell after a completed assistant turn

/** Split text into tokens that KEEP surrounding whitespace, so re-joining a
 *  prefix reproduces the original spacing exactly (`"a b"` → `["a ", "b"]`). */
function tokenize(text: string): string[] {
  return text.match(/\s*\S+\s*/g) ?? (text ? [text] : [])
}

/**
 * Expand a message list into ordered playback frames reproducing the live
 * stream: each user turn lands whole; each assistant turn first shows a
 * `thinking` indicator, then streams its text token-by-token, then pops any
 * tool / approval segments. Frame COUNT for a given prefix is deterministic, so
 * a host that appends a continuation (e.g. after an Approve) resumes seamlessly
 * from where it paused — the shared prefix's frames are unchanged.
 */
export function buildStreamFrames(messages: HistoricalMessage[]): StreamFrame[] {
  const frames: StreamFrame[] = []
  const revealed: HistoricalMessage[] = []
  const push = (msgs: HistoricalMessage[], phase: StreamingPhase, typing: boolean, delayMs: number) =>
    frames.push({ messages: msgs.slice(), phase, typing, delayMs })

  messages.forEach((msg) => {
    if (isHistoricalUserTurn(msg)) {
      revealed.push(msg)
      push(revealed, 'idle', false, USER_MS)
      return
    }

    // Assistant turn: a `thinking` pause, then stream this turn's segments in
    // order. The pause is emitted ONLY when there is already content to show
    // (`revealed.length > 0`) — an empty first frame would hand the surface a
    // zero-message list, flashing its empty state before the opening line.
    if (revealed.length > 0) push(revealed, 'thinking', true, THINK_MS)

    const segs = normalizeHistoricalMessageData(msg.messageData)
    const built: MessageData[] = []
    const emit = () => push([...revealed, { ...msg, messageData: [...built] }], 'streaming', false, 0)

    segs.forEach((seg) => {
      if (isTextSegment(seg)) {
        const tokens = tokenize(seg.text)
        let acc = ''
        built.push({ ...seg, text: '' })
        tokens.forEach((tok) => {
          acc += tok
          built[built.length - 1] = { ...seg, text: acc }
          push([...revealed, { ...msg, messageData: [...built] }], 'streaming', false, TOKEN_MS)
        })
        built[built.length - 1] = { ...seg }
      } else {
        // Tool / approval segment: pops in fully.
        built.push(seg)
        emit()
        frames[frames.length - 1].delayMs = SEGMENT_MS
      }
    })

    revealed.push(msg)
    push(revealed, 'idle', false, POST_MS)
  })

  if (frames.length === 0) push(revealed, 'idle', false, 0)

  // The streaming/"thinking" indicator must stay up for the WHOLE replay and be
  // removed only when the stream FINISHES — never blink off between turns or
  // while text streams (that reads as flicker). So `typing` is true for every
  // frame except the terminal one; `phase` is left accurate for other logic.
  // (`ChatMessageList`'s `showStreamingLoader` still hides it on a frame whose
  // last segment is a pending approval, i.e. when the agent is truly paused.)
  const lastIdx = frames.length - 1
  frames.forEach((f, i) => {
    f.typing = i < lastIdx
  })
  return frames
}

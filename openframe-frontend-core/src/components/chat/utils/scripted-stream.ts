/**
 * Scripted-conversation replay: turn a stored conversation into ordered "mock stream" playback frames that animate a chat
 * surface exactly like the live stream (a `thinking` pause, then assistant text token-by-token, then tool / approval parts
 * popping in, then `idle`), just replayed from a script instead of a network stream.
 *
 * Lives in the lib (not a host) so any consumer (marketing hero demos, docs, onboarding tours) can drive a `previewMode`
 * `EmbeddableChat` or a `ChatMessageList` from a canned conversation without re-implementing the streaming cadence. Pair
 * with {@link useScriptedStream} (the playback clock).
 */

import { isSourcePart, type ChatMessage, type ChatPart } from '../../../chat-protocol/chat-message';
import type { StreamingPhase } from '../types';

/** One rendered step of the mocked stream. */
export interface StreamFrame {
  /** The partial message list to show at this step. */
  messages: ChatMessage[];
  phase: StreamingPhase;
  /** The chat "typing" indicator (up during the `thinking` pause). */
  typing: boolean;
  /** Hold time (ms) before advancing to the next frame. */
  delayMs: number;
}

// Playback cadence. Assistant turns "think" then stream token-by-token; user
// turns land at once. Tuned to read like a real chat without dragging.
const THINK_MS = 550;
const TOKEN_MS = 55; // per word revealed while streaming text
const USER_MS = 480; // dwell on a user turn before the reply starts thinking
const PART_MS = 340; // a tool / approval card pops in
const POST_MS = 240; // dwell after a completed assistant turn

/** Split text into tokens that KEEP surrounding whitespace, so re-joining a
 *  prefix reproduces the original spacing exactly (`"a b"` → `["a ", "b"]`). */
function tokenize(text: string): string[] {
  return text.match(/\s*\S+\s*/g) ?? (text ? [text] : []);
}

/**
 * Expand a thread into ordered playback frames reproducing the live stream: each user turn lands whole; each assistant
 * turn first shows a `thinking` indicator, then streams its text token-by-token, then pops any tool / approval parts.
 * Frame COUNT for a given prefix is deterministic, so a host that appends a continuation (e.g. after an Approve) resumes
 * seamlessly from where it paused: the shared prefix's frames are unchanged.
 */
export function buildStreamFrames(messages: ChatMessage[]): StreamFrame[] {
  const frames: StreamFrame[] = [];
  const revealed: ChatMessage[] = [];
  const push = (msgs: ChatMessage[], phase: StreamingPhase, typing: boolean, delayMs: number) =>
    frames.push({ messages: msgs.slice(), phase, typing, delayMs });

  messages.forEach(message => {
    if (message.role !== 'assistant') {
      revealed.push(message);
      push(revealed, 'idle', false, USER_MS);
      return;
    }

    // Assistant turn: a `thinking` pause, then stream this turn's parts in
    // order. The pause is emitted ONLY when there is already content to show
    // (`revealed.length > 0`): an empty first frame would hand the surface a
    // zero-message list, flashing its empty state before the opening line.
    if (revealed.length > 0) push(revealed, 'thinking', true, THINK_MS);

    // A source part draws nothing of its own: it is there from the first token, as it is on the wire.
    const built: ChatPart[] = message.parts.filter(isSourcePart);
    const frameOf = (): ChatMessage[] => [...revealed, { ...message, parts: [...built] }];

    for (const part of message.parts) {
      if (isSourcePart(part)) continue;
      if (part.type === 'text') {
        let acc = '';
        built.push({ ...part, text: '', state: 'streaming' });
        for (const token of tokenize(part.text)) {
          acc += token;
          built[built.length - 1] = { ...part, text: acc, state: 'streaming' };
          push(frameOf(), 'streaming', false, TOKEN_MS);
        }
        built[built.length - 1] = part;
      } else {
        // Tool / approval part: pops in fully.
        built.push(part);
        push(frameOf(), 'streaming', false, PART_MS);
      }
    }

    revealed.push(message);
    push(revealed, 'idle', false, POST_MS);
  });

  if (frames.length === 0) push(revealed, 'idle', false, 0);

  // The streaming/"thinking" indicator must stay up for the WHOLE replay and be
  // removed only when the stream FINISHES: it must never blink off between turns or
  // while text streams (that reads as flicker). So `typing` is true for every
  // frame except the terminal one; `phase` is left accurate for other logic.
  // (`ChatMessageList`'s `showStreamingLoader` still hides it on a frame whose
  // last part is a pending approval, i.e. when the agent is truly paused.)
  const lastIdx = frames.length - 1;
  for (const [i, frame] of frames.entries()) {
    frame.typing = i < lastIdx;
  }
  return frames;
}

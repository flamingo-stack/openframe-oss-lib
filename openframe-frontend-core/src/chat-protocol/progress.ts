/**
 * What a turn is doing before its first answer token: the named stages a server
 * reports while it works, and the line a client shows for each.
 *
 * A retrieval chat spends seconds before any text exists (reading the question,
 * searching, reading what it found). A generic spinner for that whole time says
 * nothing; a line naming the real step ("Searching 28 sources") does, and people
 * wait more willingly for it. The stage is a FIXED vocabulary on the wire (never
 * model text, a rewritten query or a source name), so it is safe on a public
 * chat and the wording stays the client's: `chatProgressLabel` is the one place
 * the copy lives.
 *
 * Wire: the existing `{ status: 'thinking' }` leading frame, with an optional
 * `stage` and `count`. A client that predates the stage reads the frame exactly
 * as before; a client that knows it shows the line. A stage it does not know is
 * dropped (the frame is still a plain "thinking").
 *
 * Server-safe: no React, no browser APIs.
 */

export const CHAT_PROGRESS_STAGES = ['understanding', 'searching', 'searching_again', 'reading'] as const;

export type ChatProgressStage = (typeof CHAT_PROGRESS_STAGES)[number];

export interface ChatProgress {
  stage: ChatProgressStage;
  /** How many of the thing the stage works on: sources searched, results read. */
  count?: number;
}

export function isChatProgressStage(value: unknown): value is ChatProgressStage {
  return typeof value === 'string' && (CHAT_PROGRESS_STAGES as readonly string[]).includes(value);
}

/** A parsed status frame's progress, or null when it carries no stage this client knows. */
export function chatProgressOf(frame: { stage?: unknown; count?: unknown }): ChatProgress | null {
  if (!isChatProgressStage(frame.stage)) return null;
  const count =
    typeof frame.count === 'number' && Number.isFinite(frame.count) && frame.count > 0
      ? Math.floor(frame.count)
      : undefined;
  return count === undefined ? { stage: frame.stage } : { stage: frame.stage, count };
}

const PROGRESS_LABEL: Record<ChatProgressStage, (count: number | undefined) => string> = {
  understanding: () => 'Understanding your question',
  searching: count => (count ? `Searching ${count} ${count === 1 ? 'source' : 'sources'}` : 'Searching'),
  searching_again: () => 'Searching more broadly',
  reading: count => (count ? `Reading ${count} ${count === 1 ? 'result' : 'results'}` : 'Reading the results'),
};

/** The one line shown for a stage. Specific when the server gave a real count, never an invented one. */
export function chatProgressLabel(progress: ChatProgress): string {
  return PROGRESS_LABEL[progress.stage](progress.count);
}

/**
 * What a turn is doing before its first answer token: the named stages a server reports while it works, and the line
 * a client shows for each.
 *
 * A retrieval chat spends seconds before any text exists (reading the question, searching, reading what it found). Each
 * stage is reported as a step of the turn, in the chunk shape a NATS tool run has (`ToolExecutionFrame`), so the chat
 * draws it as the row it draws for a tool run: working while the stage runs, done when it ends. The stage is a FIXED
 * vocabulary (never model text, a rewritten query or a source name), so it is safe on a public chat, and its line lives
 * here only (`chatProgressLabel`).
 *
 * Server-safe: no React, no browser APIs.
 */

import type { ToolExecutionFrame } from './frames';

export const CHAT_PROGRESS_STAGES = ['understanding', 'searching', 'searching_again', 'reading'] as const;

export type ChatProgressStage = (typeof CHAT_PROGRESS_STAGES)[number];

export interface ChatProgress {
  stage: ChatProgressStage;
  /** How many of the thing the stage works on: sources searched, results read. */
  count?: number;
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

/**
 * The frame for a stage of one turn: `running` opens its row, `done` or `failed` closes it. `turnId` keeps the row's id
 * unique to the turn, since a closing frame updates the open row of the same id anywhere in the thread.
 */
export function chatProgressFrame(
  progress: ChatProgress,
  state: 'running' | 'done' | 'failed',
  turnId: string,
): ToolExecutionFrame {
  const id = `${turnId}:${progress.stage}`;
  const title = chatProgressLabel(progress);
  return state === 'running'
    ? { type: 'EXECUTING_TOOL', toolFunction: progress.stage, title, toolExecutionRequestId: id }
    : {
        type: 'EXECUTED_TOOL',
        toolFunction: progress.stage,
        title,
        toolExecutionRequestId: id,
        success: state === 'done',
      };
}

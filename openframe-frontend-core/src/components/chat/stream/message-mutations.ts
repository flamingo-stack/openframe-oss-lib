/**
 * What the reducer needs beside the one list rule (`applyChunkToMessages`): the ids it mints, the rows it dedups, and the
 * chunks a status it already knows stands for.
 *
 * Framework-free: no React, no timers.
 */

import { APPROVAL_CANCELLED, type ChatMessage } from '../../../chat-protocol/chat-message';
import type { UiChunk } from '../../../chat-protocol/ui-chunks';
import type { ChatApprovalStatus } from '../types';

export function nextId(role: 'user' | 'assistant'): string {
  // Date.now() + counter sliver keeps ids monotonic even when two
  // messages are produced inside the same ms tick (user + assistant
  // placeholder fire back-to-back from a single sendMessage call).
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Realtime user/direct/system chunks can be replays of rows already on
 * screen. Content-window dedup is the LAST layer (seq-less transports only)
 * — see the layer list in `chat-stream-reducer.ts`.
 */
export const CONTENT_DEDUP_WINDOW = 4;
export const SYSTEM_DEDUP_WINDOW = 10;

export function hasRecentMessage(
  prev: readonly ChatMessage[],
  predicate: (message: ChatMessage) => boolean,
  window: number,
): boolean {
  const start = Math.max(0, prev.length - window);
  for (let i = prev.length - 1; i >= start; i--) {
    if (predicate(prev[i])) return true;
  }
  return false;
}

/**
 * The chunks a resolution stands for, when it was learned some other way than off the stream: a parked map, a persisted
 * status, another side of the same dialog. `id` names an approval or a whole batch; an escalation offer is a chunk of its
 * own, and its id space is the same collection, so the chunk that does not match is a no-op.
 */
export function resolutionChunks(id: string, status: ChatApprovalStatus, resolvedByName?: string | null): UiChunk[] {
  const offer: UiChunk = {
    type: 'data-escalation-offer',
    id,
    data: { status, ...(resolvedByName ? { resolvedByName } : {}) },
  };
  if (status === 'pending') return [offer];
  const toolMetadata = resolvedByName ? { toolMetadata: { resolvedByName } } : {};
  if (status === 'approved') {
    return [offer, { type: 'tool-approval-response', approvalId: id, approved: true, ...toolMetadata }];
  }
  return [
    offer,
    {
      type: 'tool-approval-response',
      approvalId: id,
      approved: false,
      ...(status === 'cancelled' ? { reason: APPROVAL_CANCELLED } : {}),
      ...toolMetadata,
    },
    { type: 'tool-output-denied', toolCallId: id },
  ];
}

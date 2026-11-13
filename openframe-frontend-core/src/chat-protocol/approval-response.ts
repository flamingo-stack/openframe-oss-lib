/**
 * Approvals on the wire, read by a server: the tool parts a turn left asking (`pendingApprovalPartsOf`) and the answers
 * a request carries back (`approvalResponsesOf`). The AI SDK's round trip: the client answers with the card's message,
 * its tool parts in `approval-responded` (`addToolApprovalResponse`, "sending only the last message").
 *
 * THE one reading of both, for the hub's chat route, its MCP stream collector and any other server that answers an
 * approval. Server-safe: no React, no browser APIs.
 */

import { isToolPart, type ChatPart, type ChatToolPart } from './chat-message';
import { isRecord } from './wire-narrow';

/** A tool part still asking for its approval. */
export type ChatPendingApprovalPart = Extract<ChatToolPart, { state: 'approval-requested' }>;

/** The tool parts still asking for their approval, in the order the turn wrote them. */
export function pendingApprovalPartsOf(parts: readonly ChatPart[]): ChatPendingApprovalPart[] {
  return parts.filter(
    (part): part is ChatPendingApprovalPart => isToolPart(part) && part.state === 'approval-requested',
  );
}

/** One answered approval, as a request states it. */
export interface ToolApprovalResponse {
  /** The proposal the answer decides: the part's `approval.id`. */
  proposalId: string;
  /** The tool call the answer belongs to; the proposal's id when the part names none. */
  toolCallId: string;
  approved: boolean;
  /** The reject reason. */
  reason?: string;
  /** The person's edited arguments, when the part states any. A server re-binds what the proposal locked. */
  editedArgs?: Record<string, unknown>;
}

/**
 * The approvals a message answers: its tool parts in `approval-responded`, one per proposal (a proposal is decided once,
 * by the first part that names it). The message is read off the wire, so anything else names none.
 */
export function approvalResponsesOf(message: unknown): ToolApprovalResponse[] {
  const parts: unknown[] = isRecord(message) && Array.isArray(message.parts) ? message.parts : [];
  const responses: ToolApprovalResponse[] = [];
  const decided = new Set<string>();
  for (const part of parts) {
    const response = responseOfPart(part);
    if (!response || decided.has(response.proposalId)) continue;
    decided.add(response.proposalId);
    responses.push(response);
  }
  return responses;
}

/** The answer one part carries, or null when it carries none. */
function responseOfPart(part: unknown): ToolApprovalResponse | null {
  if (!isRecord(part) || part.state !== 'approval-responded') return null;
  const { approval, toolCallId, input } = part;
  if (!isRecord(approval) || typeof approval.id !== 'string' || !approval.id) return null;
  if (typeof approval.approved !== 'boolean') return null;
  return {
    proposalId: approval.id,
    toolCallId: typeof toolCallId === 'string' && toolCallId ? toolCallId : approval.id,
    approved: approval.approved,
    ...(typeof approval.reason === 'string' && approval.reason ? { reason: approval.reason } : {}),
    ...(isRecord(input) && Object.keys(input).length > 0 ? { editedArgs: input } : {}),
  };
}

/**
 * What the chat's tool rows and approval cards draw, from a tool part. The part's `state` and `approval` are the only
 * facts: a row says "running" because it has no output yet, and a card says "approved" because its approval does.
 *
 * Pure: no React, no DOM.
 */

import {
  approvalBatchIdOf,
  approvalStatusOf,
  isToolPart,
  type ChatPart,
  type ChatProgressRow,
  type ChatToolPart,
} from '../../../chat-protocol/chat-message';
import { chatProgressLabel } from '../../../chat-protocol/progress';
import { ToolTypeValues } from '../../../types/tool.types';
import type { ChatApprovalPartStatus } from '../types/chat.types';
import type {
  ApprovalBatchData,
  ApprovalBatchExecutionState,
  ApprovalRequestData,
  PendingToolCallData,
  ToolExecutionData,
} from '../types/message.types';
import { approvalDisplaysInline } from './approval-display';

function resultTextOf(output: unknown): string | undefined {
  if (output === null || output === undefined) return undefined;
  return typeof output === 'string' ? output : JSON.stringify(output);
}

function argsOf(input: unknown): Record<string, unknown> | undefined {
  return input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : undefined;
}

/** The row a tool run draws. */
export function toolExecutionDataOf(part: ChatToolPart): ToolExecutionData {
  const metadata = part.toolMetadata;
  const row: ToolExecutionData = {
    type: part.state === 'output-available' || part.state === 'output-error' ? 'EXECUTED_TOOL' : 'EXECUTING_TOOL',
    integratedToolType: metadata?.integratedToolType ?? '',
    toolFunction: part.toolName,
    toolExecutionRequestId: part.toolCallId,
    ...(part.title !== undefined ? { toolTitle: part.title } : {}),
    ...(metadata?.toolExplanation !== undefined ? { toolExplanation: metadata.toolExplanation } : {}),
    ...(metadata?.statusLabel !== undefined ? { statusLabel: metadata.statusLabel } : {}),
  };
  const parameters = argsOf(part.input);
  if (parameters) row.parameters = parameters;
  if (part.state === 'output-available') {
    const result = resultTextOf(part.output);
    return { ...row, success: true, ...(result !== undefined ? { result } : {}) };
  }
  if (part.state === 'output-error') return { ...row, success: false, result: part.errorText };
  return row;
}

/** The row a stage of the turn draws: its one line, with the OpenFrame mark the hub's own tools carry. */
export function progressExecutionDataOf(row: ChatProgressRow): ToolExecutionData {
  const base = {
    integratedToolType: ToolTypeValues.OPENFRAME,
    toolFunction: row.stage,
    toolTitle: chatProgressLabel(row),
    toolExecutionRequestId: row.id,
  };
  return row.state === 'running'
    ? { type: 'EXECUTING_TOOL', ...base }
    : { type: 'EXECUTED_TOOL', ...base, success: row.state === 'done' };
}

/**
 * A tool that failed before it ran (`tool-input-error`): the server names the failure and there is no run to put a cross
 * on, so it is drawn as an error row. A run that failed knows its title or its tool type from when it started.
 */
export function failedBeforeRunning(part: ChatToolPart): boolean {
  return (
    part.state === 'output-error' &&
    approvalStatusOf(part) === null &&
    !part.title &&
    !part.toolMetadata?.integratedToolType
  );
}

/** A pending approval of a tier this side does not answer waits on someone else: it is not drawn until it resolves. */
export function waitsOnAnotherTier(part: ChatToolPart, displayApprovalTypes: readonly string[] | undefined): boolean {
  if (approvalStatusOf(part) !== 'pending') return false;
  const tier = 'approval' in part ? part.approval?.descriptor?.approvalType : undefined;
  return tier !== undefined && !approvalDisplaysInline(tier, displayApprovalTypes);
}

/**
 * The tool parts this side does not draw until another tier answers. A batch draws as one card, so one row waiting holds
 * back every row of it.
 */
export function toolPartsWaitingOnAnotherTier(
  parts: readonly ChatPart[],
  displayApprovalTypes: readonly string[] | undefined,
): Set<ChatToolPart> {
  const tools = parts.filter(isToolPart);
  const waitingBatches = new Set<string>();
  for (const part of tools) {
    const batchId = approvalBatchIdOf(part);
    if (batchId !== undefined && waitsOnAnotherTier(part, displayApprovalTypes)) waitingBatches.add(batchId);
  }
  return new Set(
    tools.filter(part => {
      const batchId = approvalBatchIdOf(part);
      return batchId !== undefined ? waitingBatches.has(batchId) : waitsOnAnotherTier(part, displayApprovalTypes);
    }),
  );
}

/** The card a single approval draws, or null for a part with no approval. */
export function approvalRequestDataOf(part: ChatToolPart): ApprovalRequestData | null {
  const approval = 'approval' in part ? part.approval : undefined;
  if (!approval) return null;
  const { descriptor } = approval;
  return {
    command: part.title ?? part.toolName,
    requestId: approval.id,
    ...(approval.requestReason !== undefined ? { explanation: approval.requestReason } : {}),
    ...(descriptor?.fields !== undefined ? { fields: descriptor.fields } : {}),
    ...(descriptor?.approvalType !== undefined ? { approvalType: descriptor.approvalType } : {}),
  };
}

function isRunning(part: ChatToolPart): boolean {
  return (
    (part.state === 'approval-responded' && part.approval.approved) ||
    (part.state === 'input-available' && part.toolMetadata?.started === true)
  );
}

function executionOf(part: ChatToolPart): ApprovalBatchExecutionState | null {
  if (isRunning(part)) return { status: 'executing' };
  if (part.state === 'output-available') {
    const result = resultTextOf(part.output);
    return { status: 'done', success: true, ...(result !== undefined ? { result } : {}) };
  }
  if (part.state === 'output-error') {
    return part.toolMetadata?.outcomeUnknown
      ? { status: 'done', outcomeUnknown: true, result: part.errorText }
      : { status: 'done', success: false, result: part.errorText };
  }
  return null;
}

export interface ApprovalBatchView {
  data: ApprovalBatchData;
  status: ChatApprovalPartStatus;
  resolvedByName?: string | null;
}

/** The field a person knows a record by. A label for an id ("Task", "Ticket") names a row only when there is no other. */
const RECORD_NAME_FIELD = /^(title|subject|name)$/i;

/**
 * One row of a batch's card. A batch usually runs one tool ("Delete task" twice), so what tells its rows apart is the
 * record each touches, from the fields the server wrote for the card: the row's title says it, and expanding the row
 * shows those fields. A row with no fields (Mingo's) draws its own title and arguments.
 */
function batchRowOf(part: ChatToolPart): PendingToolCallData {
  const approval = 'approval' in part ? part.approval : undefined;
  const fields = (approval?.descriptor?.fields ?? []).filter(field => field.label && field.value);
  const name = fields.find(field => RECORD_NAME_FIELD.test(field.label)) ?? fields[0];
  const title = name ? `${part.title ?? part.toolName}: ${name.value}` : part.title;
  const explanation = part.toolMetadata?.toolExplanation ?? approval?.requestReason;
  return {
    toolExecutionRequestId: part.toolCallId,
    toolName: part.toolName,
    requiresApproval: !!approval,
    approvalType: approval?.descriptor?.approvalType ?? null,
    toolCallArguments:
      fields.length > 0
        ? Object.fromEntries(fields.map(field => [field.label, field.value]))
        : (argsOf(part.input) ?? null),
    ...(title !== undefined ? { toolTitle: title } : {}),
    ...(explanation !== undefined ? { toolExplanation: explanation } : {}),
    ...(part.toolMetadata?.integratedToolType !== undefined ? { toolType: part.toolMetadata.integratedToolType } : {}),
  };
}

/**
 * A batch's status is its gates', with one exception: a row with no gate of its own counts for what it did, because a gate
 * that failed says nothing about it. Approved while any row ran or runs; a row that failed beside it keeps its own cross. With
 * no row that ran it is `failed`, and `unknown` while a gated row may have.
 */
function batchStatusOf(parts: readonly ChatToolPart[]): ChatApprovalPartStatus {
  const statuses = parts.flatMap(part => {
    const status = approvalStatusOf(part);
    return status ? [status] : [];
  });
  if (statuses.includes('pending')) return 'pending';
  if (statuses.includes('approved')) return 'approved';
  const answer = statuses.includes('unknown') ? 'unknown' : (statuses[0] ?? 'approved');
  const anyRan = parts.some(part => part.state === 'output-available' || isRunning(part));
  return (answer === 'failed' || answer === 'unknown') && anyRan ? 'approved' : answer;
}

/** The one card a run of parts with one `batchId` draws. */
export function approvalBatchViewOf(parts: readonly ChatToolPart[]): ApprovalBatchView {
  const firstGate = parts.find(part => approvalStatusOf(part) !== null);
  const descriptor = firstGate && 'approval' in firstGate ? firstGate.approval?.descriptor : undefined;
  const executions: Record<string, ApprovalBatchExecutionState> = {};
  for (const part of parts) {
    const execution = executionOf(part);
    if (execution) executions[part.toolCallId] = execution;
  }
  const resolvedByName = parts.find(part => part.toolMetadata?.resolvedByName)?.toolMetadata?.resolvedByName;
  return {
    status: batchStatusOf(parts),
    ...(resolvedByName ? { resolvedByName } : {}),
    data: {
      approvalRequestId: approvalBatchIdOf(parts[0]) ?? parts[0].toolCallId,
      approvalType: descriptor?.approvalType ?? '',
      executions,
      toolCalls: parts.map(batchRowOf),
    },
  };
}

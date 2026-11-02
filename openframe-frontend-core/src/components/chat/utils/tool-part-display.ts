/**
 * What the chat's tool rows and approval cards draw, from a tool part. The part's `state` and `approval` are the only
 * facts: a row says "running" because it has no output yet, and a card says "approved" because its approval does.
 *
 * Pure: no React, no DOM.
 */

import {
  approvalBatchIdOf,
  approvalStatusOf,
  type ChatProgressRow,
  type ChatToolPart,
} from '../../../chat-protocol/chat-message';
import { chatProgressLabel } from '../../../chat-protocol/progress';
import { ToolTypeValues } from '../../../types/tool.types';
import type { ChatApprovalStatus } from '../types/chat.types';
import type {
  ApprovalBatchData,
  ApprovalBatchExecutionState,
  ApprovalRequestData,
  ToolExecutionData,
} from '../types/message.types';

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

function executionOf(part: ChatToolPart): ApprovalBatchExecutionState | null {
  if (part.state === 'approval-responded' && part.approval.approved) return { status: 'executing' };
  if (part.state === 'output-available') {
    const result = resultTextOf(part.output);
    return { status: 'done', success: true, ...(result !== undefined ? { result } : {}) };
  }
  if (part.state === 'output-error') return { status: 'done', success: false, result: part.errorText };
  return null;
}

export interface ApprovalBatchView {
  data: ApprovalBatchData;
  status: ChatApprovalStatus;
  resolvedByName?: string | null;
}

/** The one card a run of parts with one `batchId` draws. Its status is its gates': a row with none follows them. */
export function approvalBatchViewOf(parts: readonly ChatToolPart[]): ApprovalBatchView {
  const statuses = parts.flatMap(part => {
    const status = approvalStatusOf(part);
    return status ? [status] : [];
  });
  const status: ChatApprovalStatus = statuses.includes('pending')
    ? 'pending'
    : statuses.includes('approved')
      ? 'approved'
      : (statuses[0] ?? 'approved');
  const firstGate = parts.find(part => approvalStatusOf(part) !== null);
  const descriptor = firstGate && 'approval' in firstGate ? firstGate.approval?.descriptor : undefined;
  const executions: Record<string, ApprovalBatchExecutionState> = {};
  for (const part of parts) {
    const execution = executionOf(part);
    if (execution) executions[part.toolCallId] = execution;
  }
  const resolvedByName = parts.find(part => part.toolMetadata?.resolvedByName)?.toolMetadata?.resolvedByName;
  return {
    status,
    ...(resolvedByName ? { resolvedByName } : {}),
    data: {
      approvalRequestId: approvalBatchIdOf(parts[0]) ?? parts[0].toolCallId,
      approvalType: descriptor?.approvalType ?? '',
      executions,
      toolCalls: parts.map(part => {
        const approval = 'approval' in part ? part.approval : undefined;
        const explanation = part.toolMetadata?.toolExplanation ?? approval?.requestReason;
        return {
          toolExecutionRequestId: part.toolCallId,
          toolName: part.toolName,
          requiresApproval: !!approval,
          approvalType: approval?.descriptor?.approvalType ?? null,
          toolCallArguments: argsOf(part.input) ?? null,
          ...(part.title !== undefined ? { toolTitle: part.title } : {}),
          ...(explanation !== undefined ? { toolExplanation: explanation } : {}),
          ...(part.toolMetadata?.integratedToolType !== undefined
            ? { toolType: part.toolMetadata.integratedToolType }
            : {}),
        };
      }),
    },
  };
}

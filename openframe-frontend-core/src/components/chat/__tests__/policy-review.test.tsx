/**
 * The guardrail verdict on a Mingo command: the policy's review of a tool call, from the wire (NATS and history) to
 * the approval card and the tool chip.
 *
 * The review arrives on the approval's tool calls and on `EXECUTING_TOOL` only; these pin that it survives the merge
 * into `EXECUTED_TOOL`, that an escalated call says so before anyone opens it, and that the end-client card never
 * shows it.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { decodeNatsChunk } from '../../../chat-protocol/nats-decoder';
import { normalizePolicyReview } from '../../../chat-protocol/policy-review';
import { ApprovalBatchMessage } from '../approval-batch-message';
import { isPolicyEscalated } from '../policy-review';
import { mergeToolExecutionIfPresent } from '../stream/message-mutations';
import { ToolExecutionDisplay } from '../tool-execution-display';
import type {
  ApprovalBatchSegment,
  HistoricalMessage,
  PendingToolCallData,
  PolicyReviewData,
  ToolExecutionData,
  UnifiedChatMessage,
} from '../types';
import { createMessageSegmentAccumulator } from '../utils/message-segment-accumulator';
import { processHistoricalMessagesWithErrors } from '../utils/process-historical-messages';

const wireEscalated = {
  source: 'CLASSIFIER',
  decision: 'DENY',
  approvalLevel: 'ASK_TECHNICIAN',
  policyLevel: 'ALLOW',
  operationCodes: ['DELETE_FILES', ' '],
  matchedRules: [{ code: 'IRREVERSIBLE_LOCAL_DESTRUCTION', label: 'Irreversible local destruction' }, { code: ' ' }],
  reason: 'Recursively deletes the Downloads folder.',
};

const escalated = normalizePolicyReview(wireEscalated) as PolicyReviewData;

const allowed: PolicyReviewData = {
  source: 'CLASSIFIER',
  decision: 'POLICY',
  approvalLevel: 'ALLOW',
  policyLevel: 'ALLOW',
  operationCodes: ['CHECK_PERFORMANCE'],
  matchedRules: [],
  reason: 'Lists directories without modifying them.',
};

const call = (policyReview?: PolicyReviewData): PendingToolCallData => ({
  toolExecutionRequestId: 'exec-1',
  toolName: 'runCommand',
  toolTitle: 'Run command',
  toolExplanation: 'Deletes the Downloads folder.',
  toolType: 'OPENFRAME',
  requiresApproval: true,
  approvalType: 'ADMIN',
  toolCallArguments: { command: 'rm -rf ~/Downloads', shell: 'BASH' },
  ...(policyReview ? { policyReview } : {}),
});

const batch = (policyReview?: PolicyReviewData): ApprovalBatchSegment['data'] => ({
  approvalRequestId: 'req-1',
  approvalType: 'ADMIN',
  toolCalls: [call(policyReview)],
});

describe('normalizePolicyReview', () => {
  it('keeps what can be shown and drops blank rules and codes', () => {
    expect(escalated).toEqual({
      source: 'CLASSIFIER',
      decision: 'DENY',
      approvalLevel: 'ASK_TECHNICIAN',
      policyLevel: 'ALLOW',
      operationCodes: ['DELETE_FILES'],
      matchedRules: [{ code: 'IRREVERSIBLE_LOCAL_DESTRUCTION', label: 'Irreversible local destruction' }],
      reason: 'Recursively deletes the Downloads folder.',
    });
  });

  it('names a rule by its code when it has no label, and keeps a decision it does not know', () => {
    const review = normalizePolicyReview({ decision: 'SOMETHING_NEW', matchedRules: [{ code: 'DATA_EXFILTRATION' }] });
    expect(review?.decision).toBe('SOMETHING_NEW');
    expect(review?.matchedRules).toEqual([{ code: 'DATA_EXFILTRATION', label: 'DATA_EXFILTRATION' }]);
  });

  it('drops an unknown approval level alone, and is undefined without a review', () => {
    expect(normalizePolicyReview({ approvalLevel: 'MAYBE', policyLevel: 'ASK_USER' })).toEqual({
      policyLevel: 'ASK_USER',
      operationCodes: [],
      matchedRules: [],
    });
    expect(normalizePolicyReview(null)).toBeUndefined();
    expect(normalizePolicyReview('POLICY')).toBeUndefined();
  });

  it('is undefined when nothing in the review survives', () => {
    expect(normalizePolicyReview({})).toBeUndefined();
    expect(normalizePolicyReview({ source: 'REGEX', operationCodes: [' '], matchedRules: [{}] })).toBeUndefined();
  });
});

describe('isPolicyEscalated', () => {
  it('follows the decision, and the matched rules only when there is no decision', () => {
    const rule = [{ code: 'R', label: 'R' }];
    expect(isPolicyEscalated({ ...allowed, decision: undefined, matchedRules: rule })).toBe(true);
    expect(isPolicyEscalated({ ...allowed, decision: 'POLICY', matchedRules: rule })).toBe(false);
    expect(isPolicyEscalated({ ...allowed, decision: 'DENY' })).toBe(true);
    expect(isPolicyEscalated({ ...allowed, decision: 'SOFT_DENY' })).toBe(true);
    expect(isPolicyEscalated({ ...allowed, decision: 'HARD_DENY' })).toBe(true);
    expect(isPolicyEscalated(allowed)).toBe(false);
    expect(isPolicyEscalated({ ...allowed, decision: 'FALLBACK' })).toBe(false);
    expect(isPolicyEscalated(undefined)).toBe(false);
  });
});

describe('the review on the wire', () => {
  it('rides a live EXECUTING_TOOL chunk', () => {
    const event = decodeNatsChunk({
      type: 'EXECUTING_TOOL',
      integratedToolType: 'OPENFRAME',
      toolFunction: 'runCommand',
      toolExecutionRequestId: 'exec-1',
      policyReview: wireEscalated,
    });
    expect(event?.type === 'tool-execution' && event.data.policyReview).toEqual(escalated);
  });

  it('rides a live approval tool call', () => {
    const event = decodeNatsChunk({
      type: 'APPROVAL_REQUEST',
      approvalRequestId: 'req-1',
      approvalType: 'ADMIN',
      toolCalls: [{ ...call(), policyReview: wireEscalated }],
    });
    expect(event?.type === 'approval-request' && event.toolCalls?.[0]?.policyReview).toEqual(escalated);
  });

  it('survives the merge into EXECUTED_TOOL on a history replay', () => {
    const message: HistoricalMessage = {
      id: 'm1',
      createdAt: '2026-11-04T12:00:00Z',
      owner: { type: 'ASSISTANT' },
      messageData: [
        {
          type: 'EXECUTING_TOOL',
          integratedToolType: 'OPENFRAME',
          toolFunction: 'runCommand',
          toolExecutionRequestId: 'exec-1',
          policyReview: wireEscalated,
        },
        {
          type: 'EXECUTED_TOOL',
          integratedToolType: 'OPENFRAME',
          toolFunction: 'runCommand',
          toolExecutionRequestId: 'exec-1',
          success: true,
          result: 'done',
        },
      ],
    };
    const { messages } = processHistoricalMessagesWithErrors([message]);
    const segments = Array.isArray(messages[0]?.content) ? messages[0].content : [];
    const tool = segments.find(s => s.type === 'tool_execution');
    expect(tool?.type === 'tool_execution' && tool.data.type).toBe('EXECUTED_TOOL');
    expect(tool?.type === 'tool_execution' && tool.data.policyReview).toEqual(escalated);
  });

  it('survives the merge into EXECUTED_TOOL in the accumulator and in the live thread', () => {
    const executing: ToolExecutionData = {
      type: 'EXECUTING_TOOL',
      integratedToolType: 'OPENFRAME',
      toolFunction: 'runCommand',
      toolExecutionRequestId: 'exec-1',
      policyReview: allowed,
    };
    const executed: ToolExecutionData = { ...executing, type: 'EXECUTED_TOOL', policyReview: undefined, success: true };

    const accumulator = createMessageSegmentAccumulator();
    accumulator.addToolExecution({ type: 'tool_execution', data: executing });
    const [merged] = accumulator.addToolExecution({ type: 'tool_execution', data: executed });
    expect(merged?.type === 'tool_execution' && merged.data.policyReview).toEqual(allowed);

    const thread: UnifiedChatMessage[] = [
      { id: 'a1', role: 'assistant', segments: [{ type: 'tool_execution', data: executing }] } as UnifiedChatMessage,
    ];
    const next = mergeToolExecutionIfPresent(thread, { type: 'tool_execution', data: executed });
    const live = next?.[0]?.segments?.[0];
    expect(live?.type === 'tool_execution' && live.data.policyReview).toEqual(allowed);
  });
});

describe('ApprovalBatchMessage with a review', () => {
  it('says Mingo escalated the call before it is opened, and approves in the warning colour', () => {
    render(<ApprovalBatchMessage data={batch(escalated)} />);
    expect(screen.getByText('Mingo Escalated')).toBeTruthy();
    expect(screen.getByText('Recursively deletes the Downloads folder.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Approve' }).className).toContain('bg-ods-warning');
  });

  it("shows the policy's level and the operations once the command is opened", () => {
    render(<ApprovalBatchMessage data={batch(escalated)} />);
    fireEvent.click(screen.getByRole('button', { name: /rm -rf/ }));
    expect(screen.getByText('Guardrail Policy:')).toBeTruthy();
    expect(screen.getByText('Allow')).toBeTruthy();
    expect(screen.queryByText('Rule:')).toBeNull();
    expect(screen.getByText('DELETE_FILES')).toBeTruthy();
  });

  it('draws no alert and keeps the accent Approve when the policy decided', () => {
    render(<ApprovalBatchMessage data={batch(allowed)} />);
    expect(screen.queryByText('Mingo Escalated')).toBeNull();
    expect(screen.getByRole('button', { name: 'Approve' }).className).toContain('bg-ods-accent');
  });

  it('never shows the review on the end-client card', () => {
    render(<ApprovalBatchMessage data={batch(escalated)} variant="client" />);
    expect(screen.queryByText('Mingo Escalated')).toBeNull();
    expect(screen.queryByText('Guardrail Policy:')).toBeNull();
  });
});

describe('ToolExecutionDisplay with a review', () => {
  const ran = (policyReview: PolicyReviewData): ToolExecutionData => ({
    type: 'EXECUTED_TOOL',
    integratedToolType: 'OPENFRAME',
    toolFunction: 'runCommand',
    toolTitle: 'Run command',
    toolExecutionRequestId: 'exec-1',
    success: true,
    result: 'ok',
    policyReview,
  });

  it('puts the review between the arguments and the result', () => {
    render(<ToolExecutionDisplay message={{ ...ran(allowed), parameters: { command: 'ls' } }} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Guardrail Policy:')).toBeTruthy();
    expect(screen.getByText('CHECK_PERFORMANCE')).toBeTruthy();
    expect(screen.queryByText('Mingo Escalated')).toBeNull();
  });

  it('names the fallback the way the settings do', () => {
    render(
      <ToolExecutionDisplay
        message={ran({
          ...allowed,
          decision: 'FALLBACK',
          policyLevel: 'ASK_TECHNICIAN',
          approvalLevel: 'ASK_TECHNICIAN',
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Ask Technician (Unmatched Actions)')).toBeTruthy();
  });

  it('keeps the escalation on a run that was approved', () => {
    render(<ToolExecutionDisplay message={ran(escalated)} />);
    expect(screen.getByText('Mingo Escalated')).toBeTruthy();
  });

  it('never shows the review on the end-client row', () => {
    render(<ToolExecutionDisplay message={ran(escalated)} variant="client" />);
    expect(screen.queryByText('Mingo Escalated')).toBeNull();
  });

  it('opens no empty body for a review without rows', () => {
    const rowless: PolicyReviewData = { decision: 'POLICY', operationCodes: [], matchedRules: [] };
    render(<ToolExecutionDisplay message={{ ...ran(rowless), result: undefined }} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('does not credit an escalated level to the policy', () => {
    render(<ToolExecutionDisplay message={ran({ ...escalated, policyLevel: undefined })} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByText('Guardrail Policy:')).toBeNull();
    expect(screen.getByText('DELETE_FILES')).toBeTruthy();
  });

  it('keeps the escalation on a remote tool that has nothing else to show', () => {
    const remote: ToolExecutionData = {
      type: 'EXECUTED_TOOL',
      integratedToolType: '',
      toolFunction: 'remote_write',
      toolTitle: 'Updating the record',
      success: true,
      policyReview: { decision: 'DENY', operationCodes: [], matchedRules: [], reason: 'Writes outside the tenant.' },
    };
    render(<ToolExecutionDisplay message={remote} />);
    expect(screen.getByText('Mingo Escalated')).toBeTruthy();
  });
});

describe('a redelivered chunk', () => {
  it('with an equal review is a no-op in the live thread', () => {
    const executing: ToolExecutionData = {
      type: 'EXECUTING_TOOL',
      integratedToolType: 'OPENFRAME',
      toolFunction: 'runCommand',
      toolExecutionRequestId: 'exec-1',
      policyReview: allowed,
    };
    const thread: UnifiedChatMessage[] = [
      { id: 'a1', role: 'assistant', segments: [{ type: 'tool_execution', data: executing }] } as UnifiedChatMessage,
    ];
    const replayed = { ...executing, policyReview: structuredClone(allowed) };
    expect(mergeToolExecutionIfPresent(thread, { type: 'tool_execution', data: replayed })).toBe(thread);
  });
});

import { describe, expect, it } from 'vitest';
import type { ChatToolPart } from '../../../../chat-protocol/chat-message';
import { APPROVAL_CANCELLED } from '../../../../chat-protocol/chat-message';
import {
  approvalBatchViewOf,
  approvalRequestDataOf,
  failedBeforeRunning,
  progressExecutionDataOf,
  toolExecutionDataOf,
} from '../tool-part-display';

const base = { type: 'dynamic-tool', toolName: 'run_script', toolCallId: 'c1', input: { cmd: 'ls' } } as const;
const batchId = 'batch:p1';
const gate = (id: string) => ({ id, descriptor: { batchId, approvalType: 'ADMIN' } });

describe('toolExecutionDataOf', () => {
  it('reads a running row from its state alone', () => {
    const part: ChatToolPart = {
      ...base,
      state: 'input-available',
      title: 'Run it',
      toolMetadata: { integratedToolType: 'SHELL', toolExplanation: 'Why' },
    };
    expect(toolExecutionDataOf(part)).toEqual({
      type: 'EXECUTING_TOOL',
      integratedToolType: 'SHELL',
      toolFunction: 'run_script',
      toolExecutionRequestId: 'c1',
      toolTitle: 'Run it',
      toolExplanation: 'Why',
      parameters: { cmd: 'ls' },
    });
  });

  it('a finished row says how it ended, any output as text', () => {
    expect(toolExecutionDataOf({ ...base, state: 'output-available', output: 'done' })).toMatchObject({
      type: 'EXECUTED_TOOL',
      success: true,
      result: 'done',
    });
    expect(toolExecutionDataOf({ ...base, state: 'output-available', output: { ok: 1 } }).result).toBe('{"ok":1}');
    expect(toolExecutionDataOf({ ...base, state: 'output-error', errorText: 'boom' })).toMatchObject({
      type: 'EXECUTED_TOOL',
      success: false,
      result: 'boom',
    });
  });
});

describe('failedBeforeRunning', () => {
  it('names a tool-input-error, and not a run that failed', () => {
    const inputError: ChatToolPart = { ...base, state: 'output-error', errorText: 'No.' };
    expect(failedBeforeRunning(inputError)).toBe(true);
    expect(failedBeforeRunning({ ...inputError, title: 'Run it' })).toBe(false);
    expect(failedBeforeRunning({ ...inputError, toolMetadata: { integratedToolType: 'SHELL' } })).toBe(false);
    expect(failedBeforeRunning({ ...inputError, approval: { id: 'c1', approved: true } })).toBe(false);
    expect(failedBeforeRunning({ ...base, state: 'input-available' })).toBe(false);
  });
});

describe('approvalRequestDataOf', () => {
  it('draws the title, the reason and the descriptor, and is null with no approval', () => {
    const part: ChatToolPart = {
      ...base,
      state: 'approval-requested',
      title: 'Close ticket',
      approval: {
        id: 'p1',
        requestReason: 'Why',
        descriptor: { approvalType: 'ADMIN', fields: [{ label: 'Subject', value: 'x' }] },
      },
    };
    expect(approvalRequestDataOf(part)).toEqual({
      command: 'Close ticket',
      requestId: 'p1',
      explanation: 'Why',
      approvalType: 'ADMIN',
      fields: [{ label: 'Subject', value: 'x' }],
    });
    expect(approvalRequestDataOf({ ...base, state: 'input-available' })).toBeNull();
  });
});

describe('approvalBatchViewOf', () => {
  const row = (id: string) => ({ ...base, toolCallId: id, title: `Row ${id}` });

  it('a pending batch has no executions, and its rows name their gates', () => {
    const view = approvalBatchViewOf([
      { ...row('p1'), state: 'approval-requested', approval: gate('p1') },
      { ...row('p2'), state: 'input-available', toolMetadata: { batchId } },
    ]);
    expect(view.status).toBe('pending');
    expect(view.data.approvalRequestId).toBe(batchId);
    expect(view.data.approvalType).toBe('ADMIN');
    expect(view.data.executions).toEqual({});
    expect(view.data.toolCalls.map(call => call.requiresApproval)).toEqual([true, false]);
  });

  it('marks each row by its own state: a failed row has its cross, the others proceed', () => {
    const view = approvalBatchViewOf([
      { ...row('p1'), state: 'output-available', output: 'ok', approval: { ...gate('p1'), approved: true } },
      { ...row('p2'), state: 'output-error', errorText: 'Expired.', approval: { ...gate('p2'), approved: true } },
      { ...row('p3'), state: 'approval-responded', approval: { ...gate('p3'), approved: true } },
    ]);
    expect(view.status).toBe('approved');
    expect(view.data.executions).toEqual({
      p1: { status: 'done', success: true, result: 'ok' },
      p2: { status: 'done', success: false, result: 'Expired.' },
      p3: { status: 'executing' },
    });
  });

  it('a row with no gate of its own never runs from its state: it follows its batch', () => {
    const view = approvalBatchViewOf([
      { ...row('p1'), state: 'output-denied', approval: { ...gate('p1'), approved: false } },
      { ...row('p2'), state: 'input-available', toolMetadata: { batchId } },
    ]);
    expect(view.status).toBe('rejected');
    expect(view.data.executions).toEqual({});
  });

  it('reads a cancellation from its reason, and who resolved it from the metadata', () => {
    const view = approvalBatchViewOf([
      {
        ...row('p1'),
        state: 'output-denied',
        approval: { ...gate('p1'), approved: false, reason: APPROVAL_CANCELLED },
        toolMetadata: { resolvedByName: 'Roman' },
      },
    ]);
    expect(view.status).toBe('cancelled');
    expect(view.resolvedByName).toBe('Roman');
  });
});

describe('progressExecutionDataOf', () => {
  it('is the one-line row: running, then done or failed', () => {
    const row = { id: 't:reading', stage: 'reading', count: 2 } as const;
    expect(progressExecutionDataOf({ ...row, state: 'running' })).toMatchObject({
      type: 'EXECUTING_TOOL',
      toolTitle: 'Reading 2 results',
      integratedToolType: 'OPENFRAME',
      toolExecutionRequestId: 't:reading',
    });
    expect(progressExecutionDataOf({ ...row, state: 'done' })).toMatchObject({ type: 'EXECUTED_TOOL', success: true });
    expect(progressExecutionDataOf({ ...row, state: 'failed' })).toMatchObject({
      type: 'EXECUTED_TOOL',
      success: false,
    });
  });
});

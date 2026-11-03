import { describe, expect, it } from 'vitest';
import { applyChunkToMessages, createWireState } from '../../../../chat-protocol/apply-chunk';
import type { ChatMessage, ChatToolPart } from '../../../../chat-protocol/chat-message';
import { APPROVAL_CANCELLED, isToolPart } from '../../../../chat-protocol/chat-message';
import { createOldFrameDecoder } from '../../../../chat-protocol/old-wire';
import type { UiChunk } from '../../../../chat-protocol/ui-chunks';
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

  it('says approved only when a row ran or is running: every row refused is a failed batch, and each keeps its cross', () => {
    const failed = (id: string): ChatToolPart => ({
      ...row(id),
      state: 'output-error',
      errorText: 'Expired.',
      approval: { ...gate(id), approved: true },
      toolMetadata: { resolvedByName: 'Roman' },
    });
    const view = approvalBatchViewOf([failed('p1'), failed('p2')]);
    expect(view.status).toBe('failed');
    expect(view.data.executions).toEqual({
      p1: { status: 'done', success: false, result: 'Expired.' },
      p2: { status: 'done', success: false, result: 'Expired.' },
    });
    expect(
      approvalBatchViewOf([
        failed('p1'),
        { ...row('p2'), state: 'approval-responded', approval: { ...gate('p2'), approved: true } },
      ]).status,
    ).toBe('approved');
    expect(
      approvalBatchViewOf([
        failed('p1'),
        { ...row('p2'), state: 'output-available', output: 'ok', approval: { ...gate('p2'), approved: true } },
      ]).status,
    ).toBe('approved');
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

describe('a batch tells its rows apart by what each touches', () => {
  const fields = (name: string, task: string) => [
    { label: 'Task', value: task },
    { label: 'Name', value: name },
  ];
  const toolRows = (chunks: readonly UiChunk[]): ChatToolPart[] => {
    const wire = createWireState();
    const messages = chunks.reduce<ChatMessage[]>((held, chunk) => applyChunkToMessages(held, chunk, wire), []);
    return messages.flatMap(message => message.parts.filter(isToolPart));
  };
  const proposals = [
    { proposalId: 'p1', toolName: 'delete_clickup_task', title: 'Delete task', fields: fields('Fix login', '86a') },
    { proposalId: 'p2', toolName: 'delete_clickup_task', title: 'Delete task', fields: fields('Fix logout', '86b') },
  ];

  it('from an old hub`s batch frame, which sends no arguments', () => {
    const decoder = createOldFrameDecoder();
    const frame = `${JSON.stringify({ kind: 'approval_batch', batchId: 'batch:p1', proposals })}\0`;
    const { toolCalls } = approvalBatchViewOf(
      toolRows([...decoder.push(new TextEncoder().encode(frame)), ...decoder.end()]),
    ).data;
    expect(toolCalls.map(call => call.toolTitle)).toEqual(['Delete task: Fix login', 'Delete task: Fix logout']);
    expect(toolCalls[0].toolCallArguments).toEqual({ Task: '86a', Name: 'Fix login' });
  });

  it('from the UI stream, its labelled fields over its raw input', () => {
    const { toolCalls } = approvalBatchViewOf(
      toolRows(
        proposals.flatMap((proposal): UiChunk[] => [
          {
            type: 'tool-input-available',
            toolCallId: proposal.proposalId,
            toolName: proposal.toolName,
            input: { task_id: proposal.proposalId },
            dynamic: true,
            title: proposal.title,
          },
          {
            type: 'tool-approval-request',
            approvalId: proposal.proposalId,
            toolCallId: proposal.proposalId,
            approvalDescriptor: { fields: proposal.fields, batchId: 'batch:p1' },
          },
        ]),
      ),
    ).data;
    expect(toolCalls.map(call => call.toolTitle)).toEqual(['Delete task: Fix login', 'Delete task: Fix logout']);
    expect(toolCalls[1].toolCallArguments).toEqual({ Task: '86b', Name: 'Fix logout' });
  });

  it('by a name first, a subject or a title, and its first field when it has none of them', () => {
    const titleOf = (labelled: Array<{ label: string; value: string }>) =>
      approvalBatchViewOf([
        {
          ...base,
          title: 'Close',
          state: 'approval-requested',
          approval: { id: 'c1', descriptor: { fields: labelled } },
        },
      ]).data.toolCalls[0].toolTitle;
    expect(
      titleOf([
        { label: 'Ticket', value: '48' },
        { label: 'SUBJECT', value: 'Agent offline' },
      ]),
    ).toBe('Close: Agent offline');
    expect(titleOf([{ label: 'Ticket', value: '48' }])).toBe('Close: 48');
    expect(titleOf([{ label: '', value: 'nothing' }])).toBe('Close');
  });

  it('the tool`s name when the row has no title of its own', () => {
    const [call] = approvalBatchViewOf([
      {
        ...base,
        state: 'approval-requested',
        approval: { id: 'c1', descriptor: { fields: [{ label: 'Name', value: 'Fix login' }] } },
      },
    ]).data.toolCalls;
    expect(call.toolTitle).toBe('run_script: Fix login');
  });

  it('a row with no fields, as Mingo sends it, draws its own title and arguments', () => {
    const [call] = approvalBatchViewOf([
      { ...base, title: 'Run it', state: 'approval-requested', approval: gate('c1') },
    ]).data.toolCalls;
    expect(call.toolTitle).toBe('Run it');
    expect(call.toolCallArguments).toEqual({ cmd: 'ls' });
  });

  it('a row keeps saying it once it has answered', () => {
    const answered: ChatToolPart = {
      ...base,
      title: 'Delete task',
      state: 'output-available',
      output: {},
      approval: { id: 'c1', approved: true, descriptor: { fields: fields('Fix login', '86a'), batchId } },
    };
    expect(approvalBatchViewOf([answered]).data.toolCalls[0].toolTitle).toBe('Delete task: Fix login');
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

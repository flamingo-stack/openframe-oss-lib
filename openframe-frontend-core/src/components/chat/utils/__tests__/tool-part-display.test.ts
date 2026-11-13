import { describe, expect, it } from 'vitest';
import { applyChunkToMessages, createWireState } from '../../../../chat-protocol/apply-chunk';
import type { ChatMessage, ChatToolPart } from '../../../../chat-protocol/chat-message';
import { APPROVAL_CANCELLED, isToolPart } from '../../../../chat-protocol/chat-message';
import { createMingoDecoder } from '../../../../chat-protocol/message-decoder';
import type { UiChunk } from '../../../../chat-protocol/ui-chunks';
import {
  approvalBatchViewOf,
  failedBeforeRunning,
  holdsApprovalThatRan,
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

describe('approvalBatchViewOf, a single approval', () => {
  it('is a batch of one, answered under its approval id, with the descriptor on its row', () => {
    const part: ChatToolPart = {
      ...base,
      toolCallId: 'call-1',
      state: 'approval-requested',
      title: 'Close ticket',
      approval: {
        id: 'p1',
        requestReason: 'Why',
        descriptor: { approvalType: 'ADMIN', fields: [{ label: 'Subject', value: 'x' }] },
      },
    };
    const view = approvalBatchViewOf([part]);
    expect(view.status).toBe('pending');
    expect(view.data.approvalRequestId).toBe('p1');
    expect(view.data.approvalType).toBe('ADMIN');
    expect(view.data.toolCalls).toEqual([
      expect.objectContaining({
        toolExecutionRequestId: 'call-1',
        toolTitle: 'Close ticket: x',
        toolExplanation: 'Why',
        requiresApproval: true,
        toolCallArguments: { Subject: 'x' },
      }),
    ]);
  });

  it('a failed single approval is failed, with its reason on its row', () => {
    const view = approvalBatchViewOf([
      { ...base, state: 'output-error', errorText: 'Expired.', approval: { id: 'p1', approved: true } },
    ]);
    expect(view.status).toBe('failed');
    expect(Object.values(view.data.executions ?? {})).toEqual([
      { status: 'done', success: false, result: 'Expired.', refused: true },
    ]);
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
      p2: { status: 'done', success: false, result: 'Expired.', refused: true },
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
      p1: { status: 'done', success: false, result: 'Expired.', refused: true },
      p2: { status: 'done', success: false, result: 'Expired.', refused: true },
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

  describe('rows answered from here, before the server has said anything', () => {
    const sent = { toolMetadata: { answerSent: true } };
    const inFlight = (id: string): ChatToolPart => ({
      ...row(id),
      ...sent,
      state: 'approval-responded',
      approval: { ...gate(id), approved: true },
    });
    const ran = (id: string): ChatToolPart => ({
      ...row(id),
      ...sent,
      state: 'output-available',
      output: 'ok',
      approval: { ...gate(id), approved: true },
    });
    const refused = (id: string): ChatToolPart => ({
      ...row(id),
      ...sent,
      state: 'output-error',
      errorText: 'Expired.',
      approval: { ...gate(id), approved: true },
    });

    it('nothing has run yet: Approving, and every row waits', () => {
      const view = approvalBatchViewOf([inFlight('p1'), inFlight('p2')]);
      expect(view.status).toBe('approving');
      expect(view.answerPending).toBe(true);
      expect(view.data.executions).toEqual({ p1: { status: 'executing' }, p2: { status: 'executing' } });
    });

    it('a refused row beside one still waiting is not Approved yet, and not Failed yet', () => {
      const view = approvalBatchViewOf([refused('p1'), inFlight('p2')]);
      expect(view.status).toBe('approving');
      expect(view.answerPending).toBe(true);
    });

    it('a row that ran makes it Approved, while another still waits', () => {
      const view = approvalBatchViewOf([ran('p1'), inFlight('p2')]);
      expect(view.status).toBe('approved');
      expect(view.answerPending).toBe(true);
    });

    it('every row settled and refused is Failed, and nothing waits', () => {
      const view = approvalBatchViewOf([refused('p1'), refused('p2')]);
      expect(view.status).toBe('failed');
      expect(view.answerPending).toBe(false);
      expect(view.data.executions?.p1).toEqual({ status: 'done', success: false, refused: true, result: 'Expired.' });
    });

    it('a row with no gate that ran counts: nothing else said so yet', () => {
      const free: ChatToolPart = {
        ...row('free'),
        state: 'output-available',
        output: 'ok',
        toolMetadata: { batchId },
      };
      expect(approvalBatchViewOf([inFlight('p1'), free]).status).toBe('approved');
    });

    it('a batch rejected here reads Rejected at once, and still waits on the server', () => {
      const view = approvalBatchViewOf(
        (['p1', 'p2'] as const).map(id => ({
          ...row(id),
          ...sent,
          state: 'approval-responded' as const,
          approval: { ...gate(id), approved: false },
        })),
      );
      expect(view.status).toBe('rejected');
      expect(view.answerPending).toBe(true);
    });
  });

  describe('a gate Mingo`s server granted, which can stay in this state for good', () => {
    const decode = (rows: Array<Record<string, unknown>>) => {
      const decoder = createMingoDecoder();
      const wire = createWireState();
      let messages: ChatMessage[] = [{ id: 'a1', role: 'assistant', parts: [] }];
      wire.setMessageId('a1');
      for (const raw of rows) {
        for (const chunk of decoder.decode(raw).chunks) {
          messages = applyChunkToMessages(messages, chunk, wire);
        }
      }
      return messages[0].parts.filter(isToolPart);
    };
    const asking = {
      type: 'APPROVAL_REQUEST',
      approvalRequestId: 'req1',
      approvalType: 'ADMIN',
      toolCalls: [{ toolExecutionRequestId: 't1', toolName: 'run', toolTitle: 'Run ls', requiresApproval: true }],
    };
    const granted = { type: 'APPROVAL_RESULT', approvalRequestId: 'req1', approved: true };

    it('a batch with an approved result and no run reads Approved, with nothing waiting on an answer', () => {
      const parts = decode([asking, granted]);
      expect(parts.map(part => part.state)).toEqual(['approval-responded']);
      const view = approvalBatchViewOf(parts);
      expect(view.status).toBe('approved');
      expect(view.answerPending).toBe(false);
    });

    it('its tool`s failure stays in its row: a raw output is no sentence for the foot', () => {
      const parts = decode([
        asking,
        granted,
        {
          type: 'EXECUTED_TOOL',
          toolExecutionRequestId: 't1',
          integratedToolType: 'SHELL',
          toolFunction: 'run',
          success: false,
          result: 'Traceback (most recent call last)',
        },
      ]);
      expect(approvalBatchViewOf(parts).data.executions?.t1).toEqual({
        status: 'done',
        success: false,
        result: 'Traceback (most recent call last)',
      });
    });
  });

  describe('a row nobody knows the end of', () => {
    const unknown = (id: string): ChatToolPart => ({
      ...row(id),
      state: 'output-error',
      errorText: 'No answer.',
      approval: { ...gate(id), approved: true },
      toolMetadata: { outcomeUnknown: true },
    });
    const failed = (id: string): ChatToolPart => ({
      ...row(id),
      state: 'output-error',
      errorText: 'Expired.',
      approval: { ...gate(id), approved: true },
    });

    it('has no cross and no check, and the batch says so', () => {
      const view = approvalBatchViewOf([unknown('p1'), unknown('p2')]);
      expect(view.status).toBe('unknown');
      expect(view.data.executions?.p1).toEqual({ status: 'done', outcomeUnknown: true, result: 'No answer.' });
    });

    it('beside a refused row the batch is unknown: Failed would be a claim about both', () => {
      expect(approvalBatchViewOf([failed('p1'), unknown('p2')]).status).toBe('unknown');
      expect(approvalBatchViewOf([unknown('p1'), failed('p2')]).status).toBe('unknown');
    });

    it('beside a row that ran the batch is approved, and the row keeps saying nobody knows', () => {
      const view = approvalBatchViewOf([
        { ...row('p1'), state: 'output-available', output: 'ok', approval: { ...gate('p1'), approved: true } },
        unknown('p2'),
      ]);
      expect(view.status).toBe('approved');
      expect(view.data.executions?.p2).toEqual({ status: 'done', outcomeUnknown: true, result: 'No answer.' });
    });
  });

  describe('a mixed batch: a row with no gate of its own counts for what it did', () => {
    const failedGate: ChatToolPart = {
      ...row('gated'),
      state: 'output-error',
      errorText: 'Boom.',
      approval: { ...gate('gated'), approved: true },
    };
    const free = (extra: Partial<ChatToolPart>): ChatToolPart =>
      ({ ...row('free'), toolMetadata: { batchId }, ...extra }) as ChatToolPart;

    it('a failed gate beside a row that ran: Approved, each row with its own mark', () => {
      const view = approvalBatchViewOf([failedGate, free({ state: 'output-available', output: 'ok' })]);
      expect(view.status).toBe('approved');
      expect(view.data.executions).toEqual({
        gated: { status: 'done', success: false, result: 'Boom.', refused: true },
        free: { status: 'done', success: true, result: 'ok' },
      });
    });

    it('a failed gate beside a row that runs: Approved, and the row shows it runs', () => {
      const view = approvalBatchViewOf([
        failedGate,
        free({ state: 'input-available', toolMetadata: { batchId, started: true } }),
      ]);
      expect(view.status).toBe('approved');
      expect(view.data.executions?.free).toEqual({ status: 'executing' });
    });

    it('a failed gate beside a row that never started: Failed, and nothing runs it', () => {
      const view = approvalBatchViewOf([failedGate, free({ state: 'input-available' })]);
      expect(view.status).toBe('failed');
      expect(view.data.executions?.free).toBeUndefined();
    });

    it('every row failed: Failed', () => {
      const view = approvalBatchViewOf([failedGate, free({ state: 'output-error', errorText: 'Boom.' })]);
      expect(view.status).toBe('failed');
    });

    it('an unknown gate beside a row that ran: Approved', () => {
      const unknown: ChatToolPart = { ...failedGate, toolMetadata: { outcomeUnknown: true } };
      expect(approvalBatchViewOf([unknown, free({ state: 'output-available', output: 'ok' })]).status).toBe('approved');
      expect(approvalBatchViewOf([unknown, free({ state: 'input-available' })]).status).toBe('unknown');
    });

    it('a rejected gate stays rejected, whatever ran beside it', () => {
      const rejected: ChatToolPart = {
        ...row('gated'),
        state: 'output-denied',
        approval: { ...gate('gated'), approved: false },
      };
      expect(approvalBatchViewOf([rejected, free({ state: 'output-available', output: 'ok' })]).status).toBe(
        'rejected',
      );
    });

    it('the Mingo wire says a row started, on a decoder that never saw its card too', () => {
      const parts = (raws: readonly unknown[]): ChatToolPart[] => {
        const decoder = createMingoDecoder();
        const wire = createWireState();
        let messages: ChatMessage[] = [];
        for (const raw of raws) {
          for (const chunk of decoder.decode(raw).chunks) messages = applyChunkToMessages(messages, chunk, wire);
        }
        return messages.flatMap(message => message.parts).filter(isToolPart);
      };
      const card = {
        type: 'APPROVAL_REQUEST',
        approvalRequestId: 'B1',
        approvalType: 'ADMIN',
        toolCalls: [
          { toolExecutionRequestId: 'gated', toolName: 'wipe', requiresApproval: true, toolCallArguments: {} },
          { toolExecutionRequestId: 'free', toolName: 'read', requiresApproval: false, toolCallArguments: {} },
        ],
      };
      const approved = { type: 'APPROVAL_RESULT', approvalRequestId: 'B1', status: 'approved', approved: true };
      const exec = (id: string) => ({ type: 'EXECUTING_TOOL', toolExecutionRequestId: id, toolFunction: id });
      const done = (id: string, success: boolean) => ({
        type: 'EXECUTED_TOOL',
        toolExecutionRequestId: id,
        toolFunction: id,
        success,
        result: success ? 'ok' : 'boom',
      });
      const head = [{ type: 'MESSAGE_START', messageId: 'm' }, card, approved];

      const running = approvalBatchViewOf(parts([...head, exec('gated'), done('gated', false), exec('free')]));
      expect(running.status).toBe('approved');
      expect(running.data.executions?.free).toEqual({ status: 'executing' });

      const ran = approvalBatchViewOf(
        parts([...head, exec('free'), done('free', true), exec('gated'), done('gated', false)]),
      );
      expect(ran.status).toBe('approved');

      const never = approvalBatchViewOf(parts([...head, exec('gated'), done('gated', false)]));
      expect(never.status).toBe('failed');
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

describe('holdsApprovalThatRan', () => {
  const part = (over: Partial<ChatToolPart>) => ({ ...base, state: 'input-available', ...over }) as ChatToolPart;
  const ran = part({ state: 'output-available', output: 1, approval: { id: 'c1', approved: true } });

  it('a gate that reads Approved, or a row of a batch with an output', () => {
    expect(holdsApprovalThatRan([ran])).toBe(true);
    expect(holdsApprovalThatRan([part({ state: 'approval-responded', approval: { id: 'c1', approved: true } })])).toBe(
      true,
    );
    expect(
      holdsApprovalThatRan([part({ state: 'output-available', output: 1, toolMetadata: { batchId: 'b1' } })]),
    ).toBe(true);
  });

  it('never a proposal, a refusal, a rejection, or a tool outside any approval: asking again repeats nothing', () => {
    expect(holdsApprovalThatRan([part({ state: 'approval-requested', approval: { id: 'c1' } })])).toBe(false);
    expect(
      holdsApprovalThatRan([part({ state: 'output-error', errorText: 'no', approval: { id: 'c1', approved: true } })]),
    ).toBe(false);
    expect(holdsApprovalThatRan([part({ state: 'output-denied', approval: { id: 'c1', approved: false } })])).toBe(
      false,
    );
    expect(holdsApprovalThatRan([part({ state: 'output-available', output: 1 })])).toBe(false);
    expect(holdsApprovalThatRan([{ type: 'text', text: 'Hello' }])).toBe(false);
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

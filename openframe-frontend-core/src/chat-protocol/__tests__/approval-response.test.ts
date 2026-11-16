import { describe, expect, it } from 'vitest';
import { approvalResponsesOf, pendingApprovalPartsOf } from '../approval-response';
import type { ChatPart } from '../chat-message';

const tool = (toolCallId: string, extra: Record<string, unknown>) =>
  ({ type: 'dynamic-tool', toolName: 'update_ticket', toolCallId, input: {}, ...extra }) as unknown as ChatPart;

describe('pendingApprovalPartsOf', () => {
  it('keeps the tool parts still asking, in order', () => {
    const parts: ChatPart[] = [
      { type: 'text', text: 'I can close that.' },
      tool('p1', { state: 'approval-requested', approval: { id: 'p1' } }),
      tool('p2', { state: 'approval-responded', approval: { id: 'p2', approved: true } }),
      tool('p3', { state: 'approval-requested', approval: { id: 'p3' } }),
      tool('p4', { state: 'output-available', output: {} }),
    ];
    expect(pendingApprovalPartsOf(parts).map(part => part.approval.id)).toEqual(['p1', 'p3']);
  });

  it('finds none in a message with no tool parts', () => {
    expect(pendingApprovalPartsOf([{ type: 'text', text: 'hi' }])).toEqual([]);
  });
});

describe('approvalResponsesOf', () => {
  it('reads the responded tool parts of a message', () => {
    const message = {
      id: 'm1',
      role: 'assistant',
      parts: [
        { type: 'text', text: 'I can close that.' },
        tool('p1', {
          state: 'approval-responded',
          input: { status: 'CLOSED' },
          approval: { id: 'p1', approved: true },
        }),
        tool('p2', { state: 'approval-responded', approval: { id: 'p2', approved: false, reason: 'Not now' } }),
        tool('p3', { state: 'approval-requested', approval: { id: 'p3' } }),
      ],
    };
    expect(approvalResponsesOf(message)).toEqual([
      { proposalId: 'p1', toolCallId: 'p1', approved: true, editedArgs: { status: 'CLOSED' } },
      { proposalId: 'p2', toolCallId: 'p2', approved: false, reason: 'Not now' },
    ]);
  });

  it('a proposal named twice is one decision, the first', () => {
    const answered = (approved: boolean) =>
      tool('p1', { state: 'approval-responded', approval: { id: 'p1', approved } });
    expect(approvalResponsesOf({ parts: [answered(false), answered(true)] })).toEqual([
      { proposalId: 'p1', toolCallId: 'p1', approved: false },
    ]);
  });

  it('a part with no tool call id answers under its proposal id', () => {
    const part = { state: 'approval-responded', approval: { id: 'p9', approved: true } };
    expect(approvalResponsesOf({ parts: [part] })).toEqual([{ proposalId: 'p9', toolCallId: 'p9', approved: true }]);
  });

  it('finds none in a user turn, a malformed part, or nothing at all', () => {
    expect(approvalResponsesOf({ role: 'user', parts: [{ type: 'text', text: 'hi' }] })).toEqual([]);
    expect(
      approvalResponsesOf({ parts: [{ state: 'approval-responded', approval: { id: 'p', approved: 'yes' } }] }),
    ).toEqual([]);
    expect(
      approvalResponsesOf({ parts: [{ state: 'approval-responded', approval: { id: '', approved: true } }] }),
    ).toEqual([]);
    expect(approvalResponsesOf(undefined)).toEqual([]);
  });
});

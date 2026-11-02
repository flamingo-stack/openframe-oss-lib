/**
 * A batch of approvals on the hub's stream: one part per proposal, one `batchId` on them all, and the renderer draws a run
 * with one `batchId` as one card. There is no adjacency guess, and each row resolves by its own chunk, because one row of a
 * batch can fail with its cross while the others proceed.
 */

import { describe, it, expect } from 'vitest';
import {
  approvalBatchIdOf,
  approvalStatusOf,
  isToolPart,
  type ChatToolPart,
} from '../../../../chat-protocol/chat-message';
import type { ChatStreamEntry, UiChunk } from '../../../../chat-protocol/ui-chunks';
import { createChatStreamReducer } from '../chat-stream-reducer';

const entry = (chunk: UiChunk): ChatStreamEntry => ({ chunks: [chunk] });

const proposal = (id: string): UiChunk[] => [
  {
    type: 'tool-input-available',
    toolCallId: id,
    toolName: 'delete_clickup_task',
    input: { Task: id },
    dynamic: true,
    title: `Delete ClickUp task ${id}`,
  },
  {
    type: 'tool-approval-request',
    approvalId: id,
    toolCallId: id,
    approvalDescriptor: { fields: [{ label: 'Task', value: id }], batchId: 'batch:prop-1' },
  },
];

function withBatch() {
  const r = createChatStreamReducer();
  r.beginSseSend({ text: 'delete both' });
  for (const chunk of [...proposal('prop-1'), ...proposal('prop-2')]) r.apply(entry(chunk));
  return r;
}

const rows = (r: ReturnType<typeof createChatStreamReducer>): ChatToolPart[] =>
  r.state.messages[r.state.messages.length - 1].parts.filter(isToolPart);

describe('a batch of approvals', () => {
  it('is one part per proposal, one batch id on them all', () => {
    const r = withBatch();
    expect(rows(r).map(part => part.toolCallId)).toEqual(['prop-1', 'prop-2']);
    expect(rows(r).map(approvalBatchIdOf)).toEqual(['batch:prop-1', 'batch:prop-1']);
    expect(rows(r).map(approvalStatusOf)).toEqual(['pending', 'pending']);
  });

  it('flips every row on an answer that names the batch', () => {
    const r = withBatch();
    r.apply(entry({ type: 'tool-approval-response', approvalId: 'batch:prop-1', approved: true }));
    expect(rows(r).map(part => part.state)).toEqual(['approval-responded', 'approval-responded']);
    expect(rows(r).map(approvalStatusOf)).toEqual(['approved', 'approved']);
  });

  it("answering flips no row's run: only its own output does", () => {
    const r = withBatch();
    r.apply(entry({ type: 'tool-approval-response', approvalId: 'batch:prop-1', approved: true }));
    r.apply(entry({ type: 'tool-output-available', toolCallId: 'prop-2', output: { ok: true } }));
    expect(rows(r).map(part => part.state)).toEqual(['approval-responded', 'output-available']);
  });

  it('a failed row shows its cross, and the others go on', () => {
    const r = withBatch();
    r.apply(entry({ type: 'tool-approval-response', approvalId: 'batch:prop-1', approved: true }));
    r.apply(entry({ type: 'tool-output-error', toolCallId: 'prop-1', errorText: 'This approval expired.' }));
    r.apply(entry({ type: 'tool-output-available', toolCallId: 'prop-2', output: { ok: true } }));
    expect(rows(r).map(part => part.state)).toEqual(['output-error', 'output-available']);
    expect(rows(r)[0]).toMatchObject({ errorText: 'This approval expired.' });
    // An output grants the approval it shows: what ran was approved.
    expect(rows(r).map(approvalStatusOf)).toEqual(['approved', 'approved']);
  });

  it('a rejection denies every row', () => {
    const r = withBatch();
    r.apply(entry({ type: 'tool-approval-response', approvalId: 'batch:prop-1', approved: false, reason: 'no' }));
    r.apply(entry({ type: 'tool-output-denied', toolCallId: 'batch:prop-1' }));
    expect(rows(r).map(part => part.state)).toEqual(['output-denied', 'output-denied']);
    expect(rows(r).map(approvalStatusOf)).toEqual(['rejected', 'rejected']);
  });

  it('a single proposal has no batch', () => {
    const r = createChatStreamReducer();
    r.beginSseSend({ text: 'delete it' });
    r.apply(entry({ type: 'tool-input-available', toolCallId: 'solo', toolName: 'x', input: {} }));
    r.apply(entry({ type: 'tool-approval-request', approvalId: 'solo', toolCallId: 'solo' }));
    expect(rows(r).map(approvalBatchIdOf)).toEqual([undefined]);
    expect(rows(r).map(approvalStatusOf)).toEqual(['pending']);
  });
});

/**
 * What arrives after a turn ended, or in another message than the one being written. These guard the paths that used to
 * corrupt the thread: continuation fragments replacing the whole trailing bubble, tool chunks wiping completed replies, and a
 * standalone compaction duplicating itself.
 */

import { describe, it, expect } from 'vitest';
import { approvalStatusOf, isToolPart, type ChatMessage, type ChatPart } from '../../../../chat-protocol/chat-message';
import { createMingoDecoder } from '../../../../chat-protocol/message-decoder';
import { createChatStreamReducer } from '../chat-stream-reducer';

/** A thread already on screen, and the wire going on from there. */
function fromThread(thread: ChatMessage[]) {
  const reducer = createChatStreamReducer();
  reducer.initializeWithState(thread);
  const decoder = createMingoDecoder();
  const send = (...raw: unknown[]) => {
    for (const chunk of raw) reducer.apply(decoder.decode(chunk));
  };
  return { reducer, send };
}

const assistant = (id: string, ...parts: ChatPart[]): ChatMessage => ({ id, role: 'assistant', parts });
const user = (id: string, said: string): ChatMessage => ({ id, role: 'user', parts: [{ type: 'text', text: said }] });
const text = (said: string): ChatPart => ({ type: 'text', text: said });
/** What a part says, without how far the stream had got. */
const said = (message: ChatMessage): ChatPart[] =>
  message.parts.map(part => {
    if (part.type !== 'text' && part.type !== 'reasoning') return part;
    const { state: _state, ...content } = part;
    return content;
  });

const EXECUTING = {
  type: 'EXECUTING_TOOL',
  integratedToolType: 'SHELL',
  toolFunction: 'run_command',
  title: 'Run command',
};
const EXECUTED = {
  type: 'EXECUTED_TOOL',
  integratedToolType: 'SHELL',
  toolFunction: 'run_command',
  result: 'ok',
  success: true,
};
const withId = <T extends object>(chunk: T, toolExecutionRequestId: string) => ({ ...chunk, toolExecutionRequestId });

describe('text after a turn ended', () => {
  it('extends the trailing assistant bubble without dropping what it said', () => {
    const { reducer, send } = fromThread([user('u1', 'hi'), assistant('a1', text('done. '))]);
    send({ type: 'TEXT', text: 'continuing' });
    expect(reducer.state.messages).toHaveLength(2);
    expect(said(reducer.state.messages[1])).toEqual([text('done. continuing')]);
  });

  it('reasoning takes its own part, after the text it follows', () => {
    const { reducer, send } = fromThread([assistant('a1', text('answer'))]);
    send({ type: 'THINKING', text: 'hmm' });
    expect(said(reducer.state.messages[0])).toEqual([text('answer'), { type: 'reasoning', text: 'hmm' }]);
  });

  it('opens a fresh assistant bubble when the thread ends with a user message', () => {
    const { reducer, send } = fromThread([user('u1', 'hi')]);
    send({ type: 'TEXT', text: 'reply' });
    expect(reducer.state.messages).toHaveLength(2);
    expect(reducer.state.messages[1].role).toBe('assistant');
    expect(said(reducer.state.messages[1])).toEqual([text('reply')]);
  });
});

describe('a card a replay sends again', () => {
  const request = { type: 'APPROVAL_REQUEST', approvalRequestId: 'req-1', approvalType: 'CLIENT', command: 'ls' };
  const batch = {
    type: 'APPROVAL_REQUEST',
    approvalRequestId: 'req-1',
    approvalType: 'CLIENT',
    toolCalls: [{ toolExecutionRequestId: 'exec-1', toolName: 'run_command', requiresApproval: true }],
  };

  it('stays one card, on either shape', () => {
    for (const card of [request, batch]) {
      const { reducer, send } = fromThread([assistant('a1', text('reply'))]);
      send(card, card);
      expect(reducer.state.messages[0].parts.filter(isToolPart)).toHaveLength(1);
    }
  });

  it('keeps the answer it had: a resolved card never comes back as actionable', () => {
    const { reducer, send } = fromThread([assistant('a1', text('reply'))]);
    send(batch, { type: 'APPROVAL_RESULT', approvalRequestId: 'req-1', approved: true }, batch);
    expect(reducer.state.messages[0].parts.filter(isToolPart).map(approvalStatusOf)).toEqual(['approved']);
  });
});

describe('a tool’s run', () => {
  it('its result lands on its row, in place, and the title the row had stays', () => {
    const { reducer, send } = fromThread([user('u1', 'run it'), assistant('a1', text('running…'))]);
    send(withId(EXECUTING, 'exec-1'), withId(EXECUTED, 'exec-1'));
    const [written, row] = reducer.state.messages[1].parts;
    expect(said(reducer.state.messages[1])[0]).toEqual(text('running…'));
    expect(written.type).toBe('text');
    // The title is restored from the EXECUTING twin (the backend omits it on EXECUTED).
    expect(row).toMatchObject({ toolCallId: 'exec-1', state: 'output-available', output: 'ok', title: 'Run command' });
  });

  it('updates a row in an EARLIER bubble, not just the trailing one', () => {
    const { reducer, send } = fromThread([
      assistant('a1', {
        type: 'dynamic-tool',
        toolName: 'run_command',
        toolCallId: 'exec-1',
        state: 'input-available',
        input: {},
      }),
      assistant('a2', text('meanwhile')),
    ]);
    send(withId(EXECUTED, 'exec-1'));
    expect(reducer.state.messages[0].parts[0]).toMatchObject({ state: 'output-available', output: 'ok' });
    expect(said(reducer.state.messages[1])).toEqual([text('meanwhile')]);
  });

  it('merges into the row of a batch it ran for', () => {
    const { reducer, send } = fromThread([assistant('a1', text('reply'))]);
    send(
      {
        type: 'APPROVAL_REQUEST',
        approvalRequestId: 'req-1',
        approvalType: 'CLIENT',
        toolCalls: [{ toolExecutionRequestId: 'exec-1', toolName: 'run_command', requiresApproval: true }],
      },
      { type: 'APPROVAL_RESULT', approvalRequestId: 'req-1', approved: true },
      withId(EXECUTED, 'exec-1'),
    );
    const rows = reducer.state.messages[0].parts.filter(isToolPart);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ state: 'output-available', output: 'ok' });
    expect(approvalStatusOf(rows[0])).toBe('approved');
  });

  it('with no row to land on, it appends to the trailing bubble and never replaces what it said', () => {
    const { reducer, send } = fromThread([assistant('a1', text('full reply'))]);
    send(withId(EXECUTING, 'exec-9'));
    expect(said(reducer.state.messages[0])[0]).toEqual(text('full reply'));
    expect(reducer.state.messages[0].parts[1]).toMatchObject({ toolCallId: 'exec-9', state: 'input-available' });
  });

  it('never downgrades a result back to running (replayed chunk)', () => {
    const { reducer, send } = fromThread([assistant('a1', text('reply'))]);
    send(withId(EXECUTING, 'exec-1'), withId(EXECUTED, 'exec-1'));
    const before = reducer.state.messages;
    send(withId(EXECUTING, 'exec-1'));
    expect(reducer.state.messages).toBe(before);
  });

  it('pairs a result with its run when the wire names no id', () => {
    const { reducer, send } = fromThread([assistant('a1', text('reply'))]);
    send(EXECUTING, EXECUTED);
    const rows = reducer.state.messages[0].parts.filter(isToolPart);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ state: 'output-available', output: 'ok', title: 'Run command' });
  });
});

describe('a compaction', () => {
  it('a started one goes into the trailing bubble', () => {
    const { reducer, send } = fromThread([assistant('a1', text('reply'))]);
    send({ type: 'CONTEXT_COMPACTION_START', streamSeq: 1 });
    expect(reducer.state.messages[0].parts[1]).toMatchObject({
      type: 'data-context-compaction',
      data: { status: 'started' },
    });
  });

  it('its completion replaces the started one instead of duplicating, keeping the summary', () => {
    const { reducer, send } = fromThread([assistant('a1', text('reply'))]);
    send(
      { type: 'CONTEXT_COMPACTION_START', streamSeq: 1 },
      { type: 'CONTEXT_COMPACTION_END', text: 'compacted', streamSeq: 2 },
    );
    expect(said(reducer.state.messages[0])[0]).toEqual(text('reply'));
    expect(reducer.state.messages[0].parts).toHaveLength(2);
    expect(reducer.state.messages[0].parts[1]).toMatchObject({
      type: 'data-context-compaction',
      data: { status: 'completed', summary: 'compacted' },
    });
  });
});

/**
 * `useWhatToAsk` - the local "What to ask?" exchanges a chat shows beside its
 * own messages.
 *
 * Pins: an exchange lands in the conversation it was asked in (and only
 * there), a new chat's exchange follows the send that gives it a dialog but is
 * dropped when another conversation is opened instead, and the merge places
 * exchanges by time without reordering the thread.
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { textOfParts, type ChatMessage, type ChatToolPart } from '../../../../chat-protocol/chat-message';
import { awaitsDecision, mergeByTime, useWhatToAsk, type WhatToAskContent } from '../use-what-to-ask';

const content: WhatToAskContent = {
  question: 'What can I ask you?',
  reply: 'Try one:',
  groups: [{ label: 'Check', prompts: [{ label: 'Is my disk encrypted?' }] }],
  note: 'Click one to put it in the composer, then send.',
};

const message = (id: string, at: number): ChatMessage => ({
  id,
  role: 'user',
  metadata: { createdAt: new Date(at).toISOString() },
  parts: [{ type: 'text', text: id }],
});

function setup(dialogId: string | null) {
  return renderHook(({ id }) => useWhatToAsk({ dialogId: id, content }), {
    initialProps: { id: dialogId },
  });
}

const ids = (messages: ChatMessage[]) => messages.map(m => m.id);

describe('useWhatToAsk', () => {
  it('adds the question and an answer with the suggestions to the open conversation', () => {
    const { result } = setup('d-1');

    act(() => result.current.ask('current'));
    const thread = result.current.withExchanges([]);

    expect(thread).toHaveLength(2);
    expect(thread[0]).toMatchObject({ role: 'user', parts: [{ type: 'text', text: 'What can I ask you?' }] });
    expect(thread[1].role).toBe('assistant');
    expect(thread[1].parts).toEqual([
      { type: 'text', text: 'Try one:' },
      { type: 'data-suggestions', data: { groups: content.groups, note: content.note } },
    ]);
  });

  it('keeps each conversation to its own exchanges', () => {
    const { result, rerender } = setup('d-1');

    act(() => result.current.ask('current'));
    rerender({ id: 'd-2' });
    expect(result.current.withExchanges([])).toHaveLength(0);

    rerender({ id: 'd-1' });
    expect(result.current.withExchanges([])).toHaveLength(2);
  });

  it('moves a new chat exchange into the dialog its send creates', () => {
    const { result, rerender } = setup(null);

    act(() => result.current.ask('draft'));
    expect(result.current.withExchanges([])).toHaveLength(2);

    act(() => result.current.noteSend());
    rerender({ id: 'd-new' });
    expect(result.current.withExchanges([])).toHaveLength(2);

    // The new chat itself starts empty again.
    rerender({ id: null });
    expect(result.current.withExchanges([])).toHaveLength(0);
  });

  it('drops a new chat exchange when another conversation is opened instead', () => {
    const { result, rerender } = setup(null);

    act(() => result.current.ask('draft'));
    rerender({ id: 'd-other' });
    expect(result.current.withExchanges([])).toHaveLength(0);

    rerender({ id: null });
    expect(result.current.withExchanges([])).toHaveLength(0);
  });

  it('clears the new chat on request', () => {
    const { result } = setup(null);

    act(() => result.current.ask('draft'));
    act(() => result.current.clearDraft());
    expect(result.current.withExchanges([])).toHaveLength(0);
  });

  it('asks into the new chat when there is no dialog, whatever the target', () => {
    const { result, rerender } = setup(null);

    act(() => result.current.ask('current'));
    expect(result.current.withExchanges([])).toHaveLength(2);
    rerender({ id: 'd-1' });
    expect(result.current.withExchanges([])).toHaveLength(0);
  });

  it("keeps each exchange's own content, over the hook's", () => {
    const { result } = setup('d-1');
    const live: WhatToAskContent = { ...content, reply: 'Built from live data:' };

    act(() => result.current.ask('current', live));
    act(() => result.current.ask('current'));
    const answers = result.current.withExchanges([]).filter(m => m.role === 'assistant');

    expect(answers.map(m => textOfParts(m.parts))).toEqual(['Built from live data:', 'Try one:']);
  });

  it('shows nothing without content', () => {
    const { result } = renderHook(() => useWhatToAsk({ dialogId: 'd-1', content: undefined }));
    act(() => result.current.ask('current'));
    const thread = [message('a', 1)];
    expect(result.current.withExchanges(thread)).toBe(thread);
  });
});

describe('mergeByTime', () => {
  it('places local messages by time and keeps the thread order', () => {
    const thread = [message('a', 10), message('b', 30)];
    const local = [message('l1', 20), message('l2', 21)];

    expect(ids(mergeByTime(thread, local))).toEqual(['a', 'l1', 'l2', 'b']);
  });

  it('appends local messages later than the whole thread', () => {
    expect(ids(mergeByTime([message('a', 10)], [message('l', 50)]))).toEqual(['a', 'l']);
  });

  it('never moves a local message past a thread message without a time', () => {
    const untimed: ChatMessage = { id: 'u', role: 'assistant', parts: [{ type: 'text', text: 'u' }] };
    expect(ids(mergeByTime([untimed, message('b', 30)], [message('l', 20)]))).toEqual(['u', 'l', 'b']);
  });
});

describe('awaitsDecision', () => {
  const asked = (approvalType: string): ChatToolPart => ({
    type: 'dynamic-tool',
    toolName: 'command',
    toolCallId: 'r',
    state: 'approval-requested',
    input: {},
    approval: { id: 'r', descriptor: { approvalType } },
  });
  const answered: ChatToolPart = {
    type: 'dynamic-tool',
    toolName: 'command',
    toolCallId: 'r',
    state: 'approval-responded',
    input: {},
    approval: { id: 'r', approved: true },
  };
  const holding = (part: ChatToolPart): ChatMessage => ({ id: 'a', role: 'assistant', parts: [part] });

  it('is true for an approval nobody has answered', () => {
    expect(awaitsDecision([holding(asked('CLIENT'))])).toBe(true);
  });

  it('is false once it is answered, and for plain text', () => {
    expect(awaitsDecision([holding(answered)])).toBe(false);
    expect(awaitsDecision([message('a', 1)])).toBe(false);
  });

  it('a card of a tier this thread does not draw waits on someone else', () => {
    expect(awaitsDecision([holding(asked('ADMIN'))], ['CLIENT'])).toBe(false);
    expect(awaitsDecision([holding(asked('ADMIN'))], ['CLIENT', 'ADMIN'])).toBe(true);
  });

  it('a pending escalation offer waits on the user', () => {
    const offer = (status: 'pending' | 'approved'): ChatMessage => ({
      id: 'a',
      role: 'assistant',
      parts: [{ type: 'data-escalation-offer', id: 'o', data: { text: 'Hand off?', status } }],
    });
    expect(awaitsDecision([offer('pending')])).toBe(true);
    expect(awaitsDecision([offer('approved')])).toBe(false);
  });
});

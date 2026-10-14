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
import { describe, expect, it, vi } from 'vitest';
import type { Message } from '../../types/message.types';
import { mergeByTime, useWhatToAsk, type WhatToAskContent } from '../use-what-to-ask';

const content: WhatToAskContent = {
  question: 'What can I ask you?',
  reply: 'Try one:',
  groups: [{ label: 'Check', prompts: [{ label: 'Is my disk encrypted?' }] }],
  note: 'Click one to put it in the composer, then send.',
};

const message = (id: string, at: number): Message => ({
  id,
  role: 'user',
  content: id,
  timestamp: new Date(at),
});

function setup(dialogId: string | null, onPick?: (prompt: string) => void) {
  return renderHook(({ id }) => useWhatToAsk({ dialogId: id, content, onPick }), {
    initialProps: { id: dialogId },
  });
}

const ids = (messages: Message[]) => messages.map(m => m.id);

describe('useWhatToAsk', () => {
  it('adds the question and an answer with the suggestions to the open conversation', () => {
    const onPick = vi.fn();
    const { result } = setup('d-1', onPick);

    act(() => result.current.ask('current'));
    const thread = result.current.withExchanges([]);

    expect(thread).toHaveLength(2);
    expect(thread[0]).toMatchObject({ role: 'user', content: 'What can I ask you?' });
    expect(thread[1].role).toBe('assistant');
    expect(thread[1].content).toEqual([
      { type: 'text', text: 'Try one:' },
      { type: 'suggestions', groups: content.groups, note: content.note, onPick },
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
    const untimed: Message = { id: 'u', role: 'assistant', content: 'u' };
    expect(ids(mergeByTime([untimed, message('b', 30)], [message('l', 20)]))).toEqual(['u', 'l', 'b']);
  });
});

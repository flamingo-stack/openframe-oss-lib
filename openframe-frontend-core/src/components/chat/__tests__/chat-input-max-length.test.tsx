/**
 * `ChatInput`'s `maxLength`: the count from 90% of the limit, the limit in words and no send over it (the button,
 * Enter and the imperative `submit`), nothing cut from the draft, the limit counted on the trimmed draft as it is sent,
 * and the draft put back when the host says the send failed.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ChatInput } from '../chat-input';
import type { ChatInputRef } from '../types/component.types';

const LIMIT = 10_000;

function setup(onSend: (message: string) => void | boolean | Promise<boolean | void> = vi.fn()) {
  const ref = createRef<ChatInputRef>();
  render(<ChatInput ref={ref} onSend={onSend} maxLength={LIMIT} />);
  const type = (text: string) =>
    act(() => {
      ref.current?.setValue(text);
    });
  return { ref, type, send: () => screen.getByRole('button', { name: 'Send message' }) };
}

describe('ChatInput maxLength', () => {
  it('shows no count up to 90% of the limit', () => {
    const { type } = setup();
    type('a'.repeat(9_000));
    expect(screen.queryByTestId('chat-input-length-note')).not.toBeInTheDocument();
  });

  it('shows the count against the limit past 90% of it, with Send still on', () => {
    const { type, send } = setup();
    type('a'.repeat(9_412));
    expect(screen.getByTestId('chat-input-length-note')).toHaveTextContent('9,412 / 10,000');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(send()).toBeEnabled();
  });

  it('over the limit says the limit and turns Send off, keeping the whole draft', () => {
    const onSend = vi.fn();
    const { ref, type, send } = setup(onSend);
    type('a'.repeat(10_500));
    expect(screen.getByRole('status')).toHaveTextContent('Messages can be up to 10,000 characters');
    expect(screen.getByTestId('chat-input-length-note')).toHaveTextContent('10,500 / 10,000');
    expect(send()).toBeDisabled();
    expect(ref.current?.getValue()).toHaveLength(10_500);
  });

  it('refuses Enter over the limit', () => {
    const onSend = vi.fn();
    const { ref, type } = setup(onSend);
    type('a'.repeat(10_001));
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
    expect(ref.current?.getValue()).toHaveLength(10_001);
  });

  it('refuses the imperative submit over the limit', () => {
    const onSend = vi.fn();
    const { ref } = setup(onSend);
    act(() => {
      ref.current?.submit('a'.repeat(10_001));
    });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('sends exactly the limit, counted on the trimmed draft', () => {
    const onSend = vi.fn();
    const { type, send } = setup(onSend);
    const message = 'a'.repeat(LIMIT);
    type(`  ${message}\n `);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(send()).toBeEnabled();
    fireEvent.click(send());
    expect(onSend).toHaveBeenCalledWith(message);
  });

  it('puts the draft back when the send resolves false', async () => {
    const { ref, type, send } = setup(() => Promise.resolve(false));
    type('hello Mingo');
    fireEvent.click(send());
    expect(ref.current?.getValue()).toBe('');
    await waitFor(() => expect(ref.current?.getValue()).toBe('hello Mingo'));
  });

  it('has no limit without maxLength', () => {
    const onSend = vi.fn();
    const ref = createRef<ChatInputRef>();
    render(<ChatInput ref={ref} onSend={onSend} />);
    act(() => {
      ref.current?.submit('a'.repeat(20_000));
    });
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('chat-input-length-note')).not.toBeInTheDocument();
  });

  it("insets the note inside the host's card (hideBorder), and only there", () => {
    const ref = createRef<ChatInputRef>();
    const { rerender } = render(<ChatInput ref={ref} onSend={vi.fn()} maxLength={LIMIT} hideBorder />);
    act(() => {
      ref.current?.setValue('a'.repeat(10_500));
    });
    const notes = screen.getByTestId('chat-input-notes');
    expect(notes).toContainElement(screen.getByTestId('chat-input-length-note'));
    expect(notes).toHaveClass('px-[var(--spacing-system-sf)]', 'pb-[var(--spacing-system-xsf)]');

    rerender(<ChatInput ref={ref} onSend={vi.fn()} maxLength={LIMIT} />);
    expect(screen.getByTestId('chat-input-notes')).not.toHaveClass('px-[var(--spacing-system-sf)]');
  });
});

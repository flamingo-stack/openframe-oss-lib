/**
 * The OpenFrame attachments switch on ONLY through `openframeAttachments`. Without it, ChatInput and ChatComposer
 * (the hub's Guide mode, every host today) draw the DOM they drew before the feature, and a paste keeps its text-only
 * behaviour. The snapshots were taken on the code before the feature landed: a diff here is a change Guide would see.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ChatComposer } from '../chat-composer';
import { ChatInput } from '../chat-input';
import { ChatMessageEnhanced } from '../chat-message-enhanced';
import type { ChatInputRef } from '../types/component.types';

describe('chat composer without openframeAttachments', () => {
  it('ChatInput draws the same DOM', () => {
    const { container } = render(<ChatInput onSend={() => {}} placeholder="Enter your request here…" />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('ChatComposer with the context picker (Mingo) draws the same DOM', () => {
    const { container } = render(
      <ChatComposer
        inputRef={createRef<ChatInputRef>()}
        onSend={() => {}}
        onStop={() => {}}
        sending={false}
        placeholder="Ask a question..."
        contextPicker={{ entityTypes: [], renderItems: () => null }}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('ChatComposer with the legacy attachment button (Guide) draws the same DOM', () => {
    const { container } = render(
      <ChatComposer
        inputRef={createRef<ChatInputRef>()}
        onSend={() => {}}
        onStop={() => {}}
        sending={false}
        placeholder="Ask a question..."
        showAttachmentButton
        attachmentsCount={1}
        onAddFiles={() => {}}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('a paste inserts its text and drops its files', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} placeholder="Message" />);
    const editor = screen.getByRole('textbox');
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    const file = new File(['x'], 'shot.png', { type: 'image/png' });
    const paste = fireEvent.paste(editor, {
      clipboardData: { getData: (type: string) => (type === 'text/plain' ? 'hello' : ''), files: [file] },
    });
    expect(paste).toBe(false); // default prevented, as before
    expect(editor.textContent).toBe('hello');
    expect(screen.queryByRole('list', { name: 'Attached files' })).toBeNull();
  });

  it('a hub user message with file parts draws the same DOM (ChatFileParts)', () => {
    const { container } = render(
      <ChatMessageEnhanced
        role="user"
        parts={[
          { type: 'text', text: 'Here are the screenshots' },
          {
            type: 'file',
            mediaType: 'image/png',
            filename: 'shot.png',
            url: '/api/storage/view/chat-attachments/chat/00000000-0000-0000-0000-000000000000/shot.png?t=abc',
          },
        ]}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});

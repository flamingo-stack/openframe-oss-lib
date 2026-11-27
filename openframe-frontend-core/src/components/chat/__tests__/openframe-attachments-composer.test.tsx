/**
 * OpenFrame attachments switched on through `openframeAttachments`: Fae's one-click attach button and tray over the
 * input, Mingo's "Upload File" in the `+` menu and tray under it, paste and drop of files, the counter, and Send
 * waiting for uploads and scans.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type OpenFrameAttachmentItem,
  OPENFRAME_FAE_ATTACHMENT_PROFILE,
  OPENFRAME_MINGO_ATTACHMENT_PROFILE,
} from '../../../chat-protocol/attachment-profiles';
import { ChatComposer } from '../chat-composer';
import { ChatInput } from '../chat-input';
import type { ChatInputRef, OpenFrameComposerAttachments } from '../types/component.types';

const ready: OpenFrameAttachmentItem = {
  id: 'r',
  name: 'dns-trace.log',
  size: 24 * 1024,
  mediaType: 'text/plain',
  state: 'ready',
};
const uploading: OpenFrameAttachmentItem = { ...ready, id: 'u', name: 'screen.png', state: 'uploading', progress: 40 };

function config(over: Partial<OpenFrameComposerAttachments> = {}): OpenFrameComposerAttachments {
  return {
    profile: OPENFRAME_FAE_ATTACHMENT_PROFILE,
    items: [],
    chatFileCount: 0,
    onAddFiles: vi.fn(),
    onRemove: vi.fn(),
    ...over,
  };
}

function placeCaret(el: HTMLElement) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ChatInput with openframeAttachments (Fae)', () => {
  it('opens the picker in one click from "Attach a file", with the profile in accept', () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    const attachments = config();
    render(<ChatInput onSend={() => {}} openframeAttachments={attachments} />);
    fireEvent.click(screen.getByRole('button', { name: 'Attach a file' }));
    expect(click).toHaveBeenCalledTimes(1);
    const input = screen.getByTestId('openframe-attachment-input');
    expect(input.getAttribute('accept')).toContain('.png');
    expect(input.getAttribute('accept')).not.toContain('.docx');
    const picked = new File(['a'], 'a.txt');
    fireEvent.change(input, { target: { files: [picked] } });
    expect(attachments.onAddFiles).toHaveBeenCalledWith([picked]);
  });

  it('draws the tray over the input row, and the counter', () => {
    render(<ChatInput onSend={() => {}} openframeAttachments={config({ items: [ready], chatFileCount: 1 })} />);
    const list = screen.getByRole('list', { name: 'Attached files' });
    const editor = screen.getByRole('textbox');
    expect(list.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('openframe-attachment-counter')).toHaveTextContent('1/10 · 2/20 in chat');
  });

  it('pastes files into the tray and keeps the pasted text', () => {
    const attachments = config();
    render(<ChatInput onSend={() => {}} openframeAttachments={attachments} />);
    const editor = screen.getByRole('textbox');
    placeCaret(editor);
    const shot = new File(['x'], 'screenshot.png', { type: 'image/png' });
    fireEvent.paste(editor, { clipboardData: { getData: () => 'see this', files: [shot] } });
    expect(attachments.onAddFiles).toHaveBeenCalledWith([shot]);
    expect(editor.textContent).toBe('see this');
  });

  it('pastes text alone as before', () => {
    const attachments = config();
    render(<ChatInput onSend={() => {}} openframeAttachments={attachments} />);
    const editor = screen.getByRole('textbox');
    placeCaret(editor);
    fireEvent.paste(editor, { clipboardData: { getData: () => 'plain', files: [] } });
    expect(attachments.onAddFiles).not.toHaveBeenCalled();
    expect(editor.textContent).toBe('plain');
  });

  it('takes dropped files, with the overlay while they are over it', () => {
    const attachments = config();
    render(<ChatInput onSend={() => {}} openframeAttachments={attachments} />);
    const editor = screen.getByRole('textbox');
    const dropped = new File(['x'], 'a.log');
    fireEvent.dragEnter(editor, { dataTransfer: { types: ['Files'], files: [] } });
    expect(screen.getByTestId('openframe-drop-overlay')).toHaveTextContent('Drop files to attach');
    fireEvent.drop(editor, { dataTransfer: { types: ['Files'], files: [dropped] } });
    expect(attachments.onAddFiles).toHaveBeenCalledWith([dropped]);
    expect(screen.queryByTestId('openframe-drop-overlay')).toBeNull();
  });

  it('ignores a drag that carries no files', () => {
    render(<ChatInput onSend={() => {}} openframeAttachments={config()} />);
    fireEvent.dragEnter(screen.getByRole('textbox'), { dataTransfer: { types: ['text/plain'], files: [] } });
    expect(screen.queryByTestId('openframe-drop-overlay')).toBeNull();
  });

  it('keeps Send disabled while a file uploads, with the note, and Enter does nothing', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} openframeAttachments={config({ items: [ready, uploading] })} />);
    const editor = screen.getByRole('textbox');
    placeCaret(editor);
    fireEvent.paste(editor, { clipboardData: { getData: () => 'hello', files: [] } });
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    fireEvent.keyDown(editor, { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByTestId('openframe-attachment-notes')).toHaveTextContent(
      'Send is available when 1 file finishes uploading and scanning.',
    );
  });

  it('sends a message of ready files alone, with no text', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} openframeAttachments={config({ items: [ready] })} />);
    const send = screen.getByRole('button', { name: 'Send message' });
    expect(send).toBeEnabled();
    fireEvent.click(send);
    expect(onSend).toHaveBeenCalledWith('');
  });

  it('removes, cancels and dismisses through onRemove', () => {
    const attachments = config({ items: [uploading] });
    render(<ChatInput onSend={() => {}} openframeAttachments={attachments} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove screen.png' }));
    expect(attachments.onRemove).toHaveBeenCalledWith('u');
  });
});

describe('ChatComposer with openframeAttachments (Mingo)', () => {
  const picker = { entityTypes: [], renderItems: () => null };

  function renderMingo(attachments: OpenFrameComposerAttachments, withPicker = true) {
    function Host() {
      return (
        <ChatComposer
          inputRef={createRef<ChatInputRef>()}
          onSend={() => {}}
          onStop={() => {}}
          sending={false}
          placeholder="Ask a question..."
          contextPicker={withPicker ? picker : undefined}
          contextPickerOpen
          openframeAttachments={attachments}
        />
      );
    }
    return render(<Host />);
  }

  it('adds "Upload File" to the + menu, opening the picker; "Assign Item" stays', () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    renderMingo(config({ profile: OPENFRAME_MINGO_ATTACHMENT_PROFILE }));
    expect(screen.getByRole('menuitem', { name: 'Assign Item' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Upload File' }));
    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('openframe-attachment-input').getAttribute('accept')).toContain('.docx');
    expect(screen.queryByRole('button', { name: 'Attach a file' })).toBeNull();
  });

  it('draws the tray under the input row', () => {
    renderMingo(config({ profile: OPENFRAME_MINGO_ATTACHMENT_PROFILE, items: [ready] }));
    const list = screen.getByRole('list', { name: 'Attached files' });
    expect(list).toHaveAttribute('data-placement', 'below');
    const editor = screen.getByRole('textbox');
    expect(editor.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('has no "Upload File" without the prop', () => {
    function Host() {
      return (
        <ChatComposer
          inputRef={createRef<ChatInputRef>()}
          onSend={() => {}}
          onStop={() => {}}
          sending={false}
          placeholder="Ask a question..."
          contextPicker={picker}
          contextPickerOpen
        />
      );
    }
    render(<Host />);
    expect(screen.getByRole('menuitem', { name: 'Assign Item' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Upload File' })).toBeNull();
  });

  it('falls back to the attach button when there is no + menu', () => {
    renderMingo(config({ profile: OPENFRAME_MINGO_ATTACHMENT_PROFILE }), false);
    expect(screen.getByRole('button', { name: 'Attach a file' })).toBeInTheDocument();
  });
});

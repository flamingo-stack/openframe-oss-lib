/**
 * A sent OpenFrame message's files: file tiles first, then the 112px image grid; an image opens the lightbox, any
 * other file goes to the host's `onOpenAttachment`. Drawn under a user bubble only when the message carries them.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { OpenFrameMessageAttachment } from '../../../chat-protocol/attachment-profiles';
import type { ChatMessage } from '../../../chat-protocol/chat-message';
import { ChatMessageEnhanced } from '../chat-message-enhanced';
import { ChatMessageList } from '../chat-message-list';
import { OpenFrameMessageAttachments } from '../openframe-message-attachments';

const attachments: OpenFrameMessageAttachment[] = [
  { id: 'f1', name: 'dns-trace.log', mediaType: 'text/plain', size: 24 * 1024 },
  {
    id: 'i1',
    name: 'screen-0921-1142.png',
    mediaType: 'image/png',
    thumbnailUrl: '/thumbs/i1',
    previewUrl: '/full/i1',
  },
  { id: 'i2', name: 'event-viewer.png', mediaType: 'image/png', thumbnailUrl: '/thumbs/i2' },
  { id: 'f2', name: 'speed-up-checklist.pdf', mediaType: 'application/pdf' },
];

describe('OpenFrameMessageAttachments', () => {
  it('draws the file tiles first, then the image grid, aligned to the message side', () => {
    render(<OpenFrameMessageAttachments attachments={attachments} align="end" />);
    const [files, images] = screen.getAllByRole('list');
    expect(files).toHaveAccessibleName('Attached files');
    expect(images).toHaveAccessibleName('Attached images');
    expect(files).toHaveClass('justify-end');
    expect(within(files).getByRole('group', { name: 'dns-trace.log, file, 24 KB' })).toBeInTheDocument();
    // An unknown size reads as the type.
    expect(within(files).getByRole('group', { name: 'speed-up-checklist.pdf, file, PDF' })).toBeInTheDocument();
    expect(
      within(images)
        .getAllByRole('img')
        .map(img => img.getAttribute('src')),
    ).toEqual(['/thumbs/i1', '/thumbs/i2']);
  });

  it('has no × and no token count on a sent tile', () => {
    render(<OpenFrameMessageAttachments attachments={attachments} onOpenAttachment={() => {}} />);
    expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull();
    expect(screen.queryByText(/tokens/)).toBeNull();
  });

  it('hands a file click to the host', () => {
    const onOpen = vi.fn();
    render(<OpenFrameMessageAttachments attachments={attachments} onOpenAttachment={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open speed-up-checklist.pdf' }));
    expect(onOpen).toHaveBeenCalledWith(attachments[3]);
  });

  it('opens an image in the lightbox, at its full picture, and closes it', () => {
    const onOpen = vi.fn();
    render(<OpenFrameMessageAttachments attachments={attachments} onOpenAttachment={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open screen-0921-1142.png' }));
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.getByAltText('Screenshot 1')).toHaveAttribute('src', '/full/i1');
    expect(screen.getByRole('button', { name: 'Next image' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByAltText('Screenshot 1')).toBeNull();
  });

  it('treats an image with no picture as a file', () => {
    const onOpen = vi.fn();
    const bare = { id: 'i3', name: 'raw.png', mediaType: 'image/png' };
    render(<OpenFrameMessageAttachments attachments={[bare]} onOpenAttachment={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open raw.png' }));
    expect(onOpen).toHaveBeenCalledWith(bare);
  });
});

describe('in the thread', () => {
  it('draws them under a user message that carries them', () => {
    render(
      <ChatMessageEnhanced
        role="user"
        parts={[{ type: 'text', text: 'Here are the files' }]}
        openframeAttachments={attachments}
      />,
    );
    expect(screen.getByTestId('openframe-message-attachments')).toBeInTheDocument();
  });

  it('draws nothing for a message without them', () => {
    render(<ChatMessageEnhanced role="user" parts={[{ type: 'text', text: 'Hi' }]} />);
    expect(screen.queryByTestId('openframe-message-attachments')).toBeNull();
  });

  it('reads them from the message metadata and forwards the open callback from the list', () => {
    const onOpen = vi.fn();
    const messages: ChatMessage[] = [
      {
        id: 'm1',
        role: 'user',
        parts: [{ type: 'text', text: 'Logs attached' }],
        metadata: { openframeAttachments: [attachments[0]] },
      },
    ];
    render(<ChatMessageList messages={messages} onOpenAttachment={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open dns-trace.log' }));
    expect(onOpen).toHaveBeenCalledWith(attachments[0]);
  });
});

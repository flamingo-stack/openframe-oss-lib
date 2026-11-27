/**
 * The OpenFrame composer tile and tray: each state's look and words, the screen-reader names, the ×, the notes under
 * the tray, the counter and the Send gate.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  type OpenFrameAttachmentItem,
  OPENFRAME_FAE_ATTACHMENT_PROFILE,
  OPENFRAME_MINGO_ATTACHMENT_PROFILE,
} from '../../../chat-protocol/attachment-profiles';
import { FileContentIcon, FileImageIcon } from '../../icons-v2-generated/documents';
import { OpenFrameAttachmentNotes } from '../openframe-attachment-notes';
import { OpenFrameAttachmentTile } from '../openframe-attachment-tile';
import { OpenFrameAttachmentTray } from '../openframe-attachment-tray';
import {
  formatTokenEstimate,
  isImageAttachment,
  isOpenFrameSendBlocked,
  splitFileNameForTile,
  summarizeOpenFrameTray,
} from '../utils/openframe-attachment-view';

const KB = 1024;
const mingo = OPENFRAME_MINGO_ATTACHMENT_PROFILE;
const fae = OPENFRAME_FAE_ATTACHMENT_PROFILE;

function item(over: Partial<OpenFrameAttachmentItem> = {}): OpenFrameAttachmentItem {
  return { id: 'a', name: 'outlook-error.png', size: 412 * KB, mediaType: 'image/png', state: 'ready', ...over };
}

describe('OpenFrameAttachmentTile', () => {
  it('reads a ready image as "name, image, size, ready" and offers "Remove <name>"', () => {
    const onRemove = vi.fn();
    render(<OpenFrameAttachmentTile item={item()} profile={fae} onRemove={onRemove} />);
    expect(screen.getByRole('group', { name: 'outlook-error.png, image, 412 KB, ready' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove outlook-error.png' }));
    expect(onRemove).toHaveBeenCalledWith('a');
  });

  it('draws the thumbnail of a ready image and the type icon of a ready file', () => {
    const { rerender } = render(<OpenFrameAttachmentTile item={item({ thumbnailUrl: 'blob:thumb' })} profile={fae} />);
    expect(screen.getByTestId('openframe-attachment-thumbnail')).toHaveAttribute('src', 'blob:thumb');
    rerender(<OpenFrameAttachmentTile item={item({ name: 'sv.log', mediaType: 'text/plain' })} profile={fae} />);
    expect(screen.queryByTestId('openframe-attachment-thumbnail')).toBeNull();
    expect(screen.getByRole('group', { name: 'sv.log, file, 412 KB, ready' })).toBeInTheDocument();
  });

  it('leads an image with no picture with the image icon, and any other file with the file icon', () => {
    const markup = (icon: ReactElement) => render(icon).container.innerHTML;
    const imageIcon = markup(<FileImageIcon size={24} className="text-ods-text-secondary" />);
    const fileIcon = markup(<FileContentIcon size={24} className="text-ods-text-secondary" />);
    const view = render(<OpenFrameAttachmentTile item={item()} profile={fae} />);
    expect(view.container.innerHTML).toContain(imageIcon);
    expect(view.container.innerHTML).not.toContain(fileIcon);
    view.unmount();
    const { container } = render(
      <OpenFrameAttachmentTile item={item({ name: 'sv.log', mediaType: 'text/plain' })} profile={fae} />,
    );
    expect(container.innerHTML).toContain(fileIcon);
    expect(container.innerHTML).not.toContain(imageIcon);
  });

  it('shows the × of a ready tile on hover only, and always on uploads and errors', () => {
    const { rerender } = render(<OpenFrameAttachmentTile item={item()} profile={fae} onRemove={() => {}} />);
    expect(screen.getByRole('button', { name: 'Remove outlook-error.png' })).toHaveClass(
      'opacity-0',
      'group-hover/tile:opacity-100',
    );
    rerender(
      <OpenFrameAttachmentTile item={item({ state: 'uploading', progress: 64 })} profile={fae} onRemove={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'Remove outlook-error.png' })).toHaveClass('opacity-100');
    rerender(
      <OpenFrameAttachmentTile item={item({ state: 'error', error: 'BLOCKED' })} profile={fae} onRemove={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'Remove outlook-error.png' })).toHaveClass('opacity-100');
  });

  it.each([
    [{ state: 'uploading', progress: 64 }, '412 KB · 64%', 'uploading 64%'],
    [{ state: 'scanning' }, 'Scanning', 'scanning'],
    [{ state: 'error', error: 'BLOCKED' }, 'Blocked by scan', 'Blocked by scan'],
    [{ state: 'error', error: 'UPLOAD_FAILED' }, 'Upload failed', 'Upload failed'],
    [{ state: 'error', error: 'TOO_LARGE' }, 'Over 20 MB', 'Over 20 MB'],
    [{ state: 'error', error: 'TYPE_NOT_ALLOWED' }, 'Format not allowed', 'Format not allowed'],
    [{ state: 'error', error: 'ARCHIVE_NOT_ALLOWED' }, 'Format not allowed', 'Format not allowed'],
  ] as const)('state %o reads "%s"', (over, caption, spoken) => {
    render(<OpenFrameAttachmentTile item={item(over)} profile={fae} />);
    const tile = screen.getByRole('group', { name: `outlook-error.png, image, 412 KB, ${spoken}` });
    expect(tile).toHaveTextContent(caption);
    expect(tile).toHaveAttribute('data-state', over.state);
  });

  it('colours an error tile with the error tokens', () => {
    render(<OpenFrameAttachmentTile item={item({ state: 'error', error: 'TOO_LARGE' })} profile={fae} />);
    expect(screen.getByTestId('openframe-attachment-frame')).toHaveClass('border-ods-error', 'bg-ods-error-secondary');
    expect(screen.getByText('Over 20 MB')).toHaveClass('text-ods-error');
  });

  it('shows the token estimate of a ready file on Mingo only', () => {
    const ready = item({ name: 'dns-trace.log', size: 24 * KB, mediaType: 'text/plain', tokenEstimate: 2600 });
    const { rerender } = render(<OpenFrameAttachmentTile item={ready} profile={mingo} />);
    expect(screen.getByRole('group')).toHaveTextContent('24 KB (~2.6k tokens)');
    rerender(<OpenFrameAttachmentTile item={ready} profile={fae} />);
    expect(screen.getByRole('group')).not.toHaveTextContent('tokens');
    rerender(<OpenFrameAttachmentTile item={{ ...ready, state: 'uploading' }} profile={mingo} />);
    expect(screen.getByRole('group')).not.toHaveTextContent('tokens');
  });

  it('keeps the end of a long name and its extension whole, and the whole name for hover and screen readers', () => {
    const name = 'outlook-error-screenshot-0921-2026.png';
    render(<OpenFrameAttachmentTile item={item({ name })} profile={fae} />);
    const tile = screen.getByRole('group');
    expect(tile).toHaveAttribute('title', name);
    const head = screen.getByTestId('openframe-attachment-name-head');
    const tail = screen.getByTestId('openframe-attachment-name-tail');
    expect(head).toHaveTextContent('outlook-error-screenshot-0921-');
    expect(head).toHaveClass('truncate');
    expect(tail).toHaveTextContent('2026.png');
    expect(tail).toHaveClass('shrink-0');
  });

  it("tells an image without a media type by the image types' extensions", () => {
    expect(isImageAttachment({ name: 'Screen.JPEG' })).toBe(true);
    expect(isImageAttachment({ name: 'anim.gif' })).toBe(true);
    expect(isImageAttachment({ name: 'report.pdf' })).toBe(false);
    expect(isImageAttachment({ name: 'clip.mp4' })).toBe(false);
    expect(isImageAttachment({ name: 'photo.png', mediaType: 'application/pdf' })).toBe(false);
  });

  it('splits a name into a shrinking head and a fixed tail, leaving short names whole', () => {
    expect(splitFileNameForTile('CleanMyPC_setup.exe')).toEqual({ head: 'CleanMyPC_s', tail: 'etup.exe' });
    expect(splitFileNameForTile('sv.log')).toEqual({ head: 'sv.log', tail: '' });
    expect(splitFileNameForTile('README')).toEqual({ head: 'README', tail: '' });
  });
});

describe('OpenFrameAttachmentTray', () => {
  it('lays Mingo out under the input, wrapping, and Fae over it, scrolling', () => {
    const items = [item({ id: '1' }), item({ id: '2', name: 'b.png' })];
    const { rerender } = render(<OpenFrameAttachmentTray items={items} profile={mingo} onRemove={() => {}} />);
    let list = screen.getByRole('list', { name: 'Attached files' });
    expect(list).toHaveAttribute('data-placement', 'below');
    expect(list).toHaveClass('flex-wrap');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    rerender(<OpenFrameAttachmentTray items={items} profile={fae} onRemove={() => {}} />);
    list = screen.getByRole('list', { name: 'Attached files' });
    expect(list).toHaveAttribute('data-placement', 'above');
    expect(list).toHaveClass('overflow-x-auto');
    expect(list).not.toHaveClass('flex-wrap');
  });

  it('draws nothing when empty', () => {
    const { container } = render(<OpenFrameAttachmentTray items={[]} profile={fae} onRemove={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('tray summary and notes', () => {
  const items: OpenFrameAttachmentItem[] = [
    item({ id: '1', state: 'ready' }),
    item({ id: '2', name: 'b.png', state: 'uploading', progress: 10 }),
    item({ id: '3', name: 'full-diagnostic-bundle.zip', state: 'error', error: 'ARCHIVE_NOT_ALLOWED' }),
    item({ id: '4', name: 'mailbox-audit-export.csv', state: 'error', error: 'TOO_LARGE' }),
  ];

  it('counts the message and the chat, leaving refused files out', () => {
    const summary = summarizeOpenFrameTray(items, mingo, 3);
    expect(summary.counter).toBe('2/10 · 5/20 in chat');
    expect(summary.erroredCount).toBe(2);
  });

  it('blocks Send while a file uploads or scans, and not for ready or refused files', () => {
    expect(isOpenFrameSendBlocked(items)).toBe(true);
    expect(isOpenFrameSendBlocked([item({ state: 'scanning' })])).toBe(true);
    expect(isOpenFrameSendBlocked([item(), item({ id: 'x', state: 'error', error: 'BLOCKED' })])).toBe(false);
  });

  it('writes one note per refused file, the pending note and the left-out note, pluralised', () => {
    render(<OpenFrameAttachmentNotes summary={summarizeOpenFrameTray(items, mingo, 0)} />);
    const notes = screen.getByTestId('openframe-attachment-notes');
    expect(notes).toHaveTextContent("full-diagnostic-bundle.zip Archives can't be sent yet. Attach the files inside");
    expect(notes).toHaveTextContent('mailbox-audit-export.csv Larger than 20 MB');
    expect(notes).toHaveTextContent('Send is available when 1 file finishes uploading and scanning');
    expect(notes.textContent).not.toContain('scanning.');
    expect(notes).toHaveTextContent("2 files won't be sent");
  });

  it('says the chat limit and pluralises the pending note', () => {
    const summary = summarizeOpenFrameTray(
      [
        item({ id: '1', state: 'scanning' }),
        item({ id: '2', state: 'uploading' }),
        item({ id: '3', state: 'error', error: 'CHAT_LIMIT' }),
      ],
      fae,
      18,
    );
    expect(summary.pendingNote).toBe('Send is available when 2 files finish uploading and scanning');
    expect(summary.leftOutNote).toBe("1 file won't be sent");
    expect(summary.errorNotes[0].text).toBe('This chat has reached 20 files');
  });

  it('says why the files do not fit: the numbers with token estimates (Mingo), words without (Fae)', () => {
    const big = [item({ id: '1', name: 'sv.log', mediaType: 'text/plain', tokenEstimate: 500 })];
    expect(summarizeOpenFrameTray(big, mingo, 0, 200).overContextNote).toBe(
      'These files need ~500 tokens, but only ~200 are left in this chat. Remove a file to send',
    );
    expect(summarizeOpenFrameTray(big, fae, 0, 200).overContextNote).toBe(
      "There's not enough room in this chat for these files. Remove a file or start a new chat",
    );
    expect(summarizeOpenFrameTray(big, fae, 0, 200).sendBlocked).toBe(true);
    expect(summarizeOpenFrameTray(big, fae, 0, 600).overContextNote).toBeNull();
  });

  it('says nothing when every file is ready', () => {
    const { container } = render(<OpenFrameAttachmentNotes summary={summarizeOpenFrameTray([item()], fae, 0)} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('formats token estimates', () => {
    expect(formatTokenEstimate(840)).toBe('~840');
    expect(formatTokenEstimate(2600)).toBe('~2.6k');
    expect(formatTokenEstimate(12400)).toBe('~12k');
  });
});

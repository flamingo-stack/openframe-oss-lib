/**
 * `ChatArchivePage` `loadError` / `onRetry`: a failed first page says so, with
 * the same block every Mingo chat list uses, instead of claiming the archive
 * is empty.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatArchivePage } from '../chat-archive-page';
import { ChatListLoadError } from '../index';

describe('ChatArchivePage loadError', () => {
  it('shows the load error with Try again instead of the empty state', () => {
    const onRetry = vi.fn();
    render(<ChatArchivePage embedded dialogs={[]} onSelectDialog={vi.fn()} loadError onRetry={onRetry} />);
    expect(screen.getByText('Couldn’t load your chats')).toBeInTheDocument();
    expect(screen.queryByText('No Archived Chats')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('keeps the archived chats it has on screen', () => {
    render(
      <ChatArchivePage
        embedded
        dialogs={[{ id: 'a', title: 'Old osquery chat', timestamp: new Date() }]}
        onSelectDialog={vi.fn()}
        loadError
      />,
    );
    expect(screen.getByText('Old osquery chat')).toBeInTheDocument();
    expect(screen.queryByText('Couldn’t load your chats')).not.toBeInTheDocument();
  });

  it('shows the skeleton while a retry loads', () => {
    render(<ChatArchivePage embedded dialogs={[]} onSelectDialog={vi.fn()} loadError isLoading />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading conversations');
    expect(screen.queryByText('Couldn’t load your chats')).not.toBeInTheDocument();
  });

  it('still shows the empty state without an error', () => {
    render(<ChatArchivePage embedded dialogs={[]} onSelectDialog={vi.fn()} />);
    expect(screen.getByText('No Archived Chats')).toBeInTheDocument();
  });
});

describe('ChatListLoadError', () => {
  it('is exported from the chat barrel, with no button without onRetry', () => {
    render(<ChatListLoadError />);
    expect(screen.getByText('Couldn’t load your chats')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

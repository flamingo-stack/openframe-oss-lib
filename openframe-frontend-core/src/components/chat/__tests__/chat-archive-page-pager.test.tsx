/**
 * `ChatArchivePage` `metaRow`: a paged archive shows the page's range and First · Previous · Next above the chats,
 * and grows on no scroll and no "Show more".
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CursorPagerFooterProps } from '../../../hooks/state/use-cursor-pager';
import { ChatArchivePage } from '../chat-archive-page';

const PAGE_2: CursorPagerFooterProps = {
  hasNextPage: true,
  hasPreviousPage: true,
  isFirstPage: false,
  page: 2,
  startCursor: null,
  endCursor: 'e2',
  rangeStart: 21,
  onNext: vi.fn(),
  onPrevious: vi.fn(),
  onFirst: vi.fn(),
};

const DIALOGS = [
  { id: 'a', title: 'Old osquery chat', timestamp: new Date() },
  { id: 'b', title: 'Disk cleanup chat', timestamp: new Date() },
];

const nextButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Go to next page' });

describe('ChatArchivePage pager', () => {
  it('shows the range (no total) and the pager above the chats, then the actions', () => {
    const { container } = render(
      <ChatArchivePage
        embedded
        dialogs={DIALOGS}
        onSelectDialog={vi.fn()}
        metaRow={{ pager: PAGE_2, actions: <span>Refresh picker</span> }}
      />,
    );
    const html = container.innerHTML;
    const order = ['21–22 chats', 'aria-label="Pagination"', 'Refresh picker', 'Old osquery chat'].map(mark =>
      html.indexOf(mark),
    );
    expect(order.every(index => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(nextButton().disabled).toBe(false);
  });

  it('has no "Show more" on a paged archive, whatever hasMore says', () => {
    render(
      <ChatArchivePage
        embedded
        dialogs={DIALOGS}
        onSelectDialog={vi.fn()}
        hasMore
        onLoadMore={vi.fn()}
        metaRow={{ pager: PAGE_2 }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('waits while the next page is read, keeping the chats on screen', () => {
    render(
      <ChatArchivePage
        embedded
        dialogs={DIALOGS}
        onSelectDialog={vi.fn()}
        metaRow={{ pager: PAGE_2, loading: true }}
      />,
    );
    expect(nextButton().disabled).toBe(true);
    expect(screen.getByText('Old osquery chat')).toBeInTheDocument();
  });

  it('an empty first page is the empty state, with no pager', () => {
    render(
      <ChatArchivePage
        embedded
        dialogs={[]}
        onSelectDialog={vi.fn()}
        metaRow={{ pager: { ...PAGE_2, page: 1, isFirstPage: true, hasPreviousPage: false, hasNextPage: false } }}
      />,
    );
    expect(screen.getByText('No Archived Chats')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go to next page' })).toBeNull();
  });

  it('keeps the pager on an empty later page, so the way back stays', () => {
    render(
      <ChatArchivePage embedded dialogs={[]} onSelectDialog={vi.fn()} metaRow={{ pager: { ...PAGE_2, page: 3 } }} />,
    );
    expect(screen.getByRole('button', { name: 'Go to previous page' })).toBeTruthy();
  });
});

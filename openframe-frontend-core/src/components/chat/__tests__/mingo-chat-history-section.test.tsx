/**
 * `MingoChatRail variant="section"`: the chat history block of the main
 * navigation sidebar. Day groups, the controlled search field, the scope, the
 * paging and the row contents; the default rail stays what it was.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { groupDialogsByDay } from '../mingo-chat-day-groups';
import { MingoChatSearchModal } from '../mingo-chat-history-section';
import { MingoChatRail } from '../mingo-chat-rail';
import type { DialogItem } from '../types/component.types';

const NOW = new Date(2026, 9, 15, 12, 0); // 15 Oct 2026, local noon

const DIALOGS: DialogItem[] = [
  { id: 'a', title: 'osquery check', timestamp: new Date(2026, 9, 15, 9, 30) },
  { id: 'b', title: '', timestamp: new Date(2026, 9, 15, 0, 5) },
  { id: 'c', title: 'Patch reports', timestamp: new Date(2026, 9, 14, 23, 50) },
  { id: 'd', title: 'RMM alert tuning', timestamp: new Date(2026, 9, 9, 10, 0) },
  { id: 'e', title: 'VPN review', timestamp: new Date(2026, 9, 9, 8, 0) },
  { id: 'f', title: 'Year-end audit', timestamp: new Date(2025, 11, 30, 16, 0) },
  { id: 'g', title: 'Imported chat' },
];

function useFixedClock() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function groupLabels() {
  return screen.getAllByRole('group').map(group => group.firstElementChild?.textContent);
}

describe('groupDialogsByDay', () => {
  it('groups by the local day: Today, Yesterday, then the date, undated last', () => {
    const groups = groupDialogsByDay(DIALOGS, NOW);
    expect(groups.map(group => group.items.map(item => item.id))).toEqual([
      ['a', 'b'],
      ['c'],
      ['d', 'e'],
      ['f'],
      ['g'],
    ]);
    const [today, yesterday, oct9, lastYear, undated] = groups.map(group => group.label);
    expect([today, yesterday, undated]).toEqual(['Today', 'Yesterday', 'Older']);
    // The day, short, in the viewer's locale ("9 Oct" / "Oct 9"); the year only when it is not this one.
    expect(oct9).toMatch(/Oct/);
    expect(oct9).toMatch(/\b9\b/);
    expect(oct9).not.toMatch(/2026/);
    expect(lastYear).toMatch(/Dec/);
    expect(lastYear).toMatch(/2025/);
  });

  it('counts a time in the future as today', () => {
    const groups = groupDialogsByDay([{ id: 'x', title: 'Skewed', timestamp: new Date(2026, 9, 16, 1) }], NOW);
    expect(groups.map(group => group.label)).toEqual(['Today']);
  });
});

describe('MingoChatRail variant="section"', () => {
  it('renders the chats grouped by day, untitled ones as "New Chat"', () => {
    useFixedClock();
    render(<MingoChatRail variant="section" dialogs={DIALOGS} activeDialogId="c" />);
    expect(screen.getByRole('region', { name: 'Chat history' })).toBeInTheDocument();
    const labels = groupLabels();
    expect(labels.slice(0, 2)).toEqual(['Today', 'Yesterday']);
    expect(labels).toHaveLength(5);
    expect(labels[4]).toBe('Older');
    const today = screen.getByRole('group', { name: 'Today' });
    expect(within(today).getByRole('button', { name: 'New Chat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Patch reports' })).toHaveAttribute('aria-current', 'true');
  });

  it('puts a chat being started on top of Today', () => {
    useFixedClock();
    render(<MingoChatRail variant="section" dialogs={DIALOGS.slice(2)} draftTitle="New Chat" />);
    expect(groupLabels()[0]).toBe('Today');
    const rows = within(screen.getByRole('group', { name: 'Today' })).getAllByRole('button');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAttribute('aria-current', 'true');
  });

  it('shows the status glyphs, and the owner only on someone else’s chat', () => {
    const owner = { name: 'Roman Smith' };
    render(
      <MingoChatRail
        variant="section"
        dialogs={[
          { id: 'mine', title: 'My chat', owner: { name: 'Pavlo Shylo' } },
          { id: 'theirs', title: 'Their chat', owner },
          { id: 'busy', title: 'Busy chat' },
          { id: 'waiting', title: 'Waiting chat' },
        ]}
        ownedByOther={dialog => dialog.id === 'theirs'}
        statusOf={dialog => (dialog.id === 'busy' ? 'working' : dialog.id === 'waiting' ? 'approval' : undefined)}
      />,
    );
    expect(screen.getByRole('img', { name: 'Owner: Roman Smith' })).toHaveTextContent('RS');
    expect(screen.queryByRole('img', { name: 'Owner: Pavlo Shylo' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: /Busy chat/ })).getByRole('img')).toHaveAccessibleName(
      'Mingo is working',
    );
    expect(within(screen.getByRole('button', { name: /Waiting chat/ })).getByRole('img')).toHaveAccessibleName(
      'Waiting for approval',
    );
  });

  it('selects a chat and offers the row actions it has handlers for', () => {
    const onSelectDialog = vi.fn();
    const onRequestArchive = vi.fn();
    render(
      <MingoChatRail
        variant="section"
        dialogs={DIALOGS.slice(0, 1)}
        onSelectDialog={onSelectDialog}
        onRequestRename={vi.fn()}
        onRequestCopyLink={vi.fn()}
        onRequestArchive={onRequestArchive}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'osquery check' }));
    expect(onSelectDialog).toHaveBeenCalledWith('a');

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Actions for osquery check' }), {
      button: 0,
      pointerType: 'mouse',
    });
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual([
      'Rename Chat',
      'Copy Chat Link',
      'Archive Chat',
    ]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Archive Chat' }));
    expect(onRequestArchive).toHaveBeenCalledWith(DIALOGS[0]);
  });

  it('opens the archive from the ⋯ menu, with no count', () => {
    const onOpenArchive = vi.fn();
    render(<MingoChatRail variant="section" dialogs={DIALOGS} onOpenArchive={onOpenArchive} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'More' }), { button: 0, pointerType: 'mouse' });
    const item = screen.getByRole('menuitem', { name: 'Chat archive' });
    expect(item).toHaveTextContent(/^Chat archive$/);
    fireEvent.click(item);
    expect(onOpenArchive).toHaveBeenCalledTimes(1);
  });

  it('asks the host to open the search when controlled, and leaves the modal to it', () => {
    const onSearchOpenChange = vi.fn();
    const props = { variant: 'section' as const, dialogs: DIALOGS, onSearchOpenChange, onSearchChange: vi.fn() };
    const { rerender } = render(<MingoChatRail {...props} searchOpen={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Search chats' }));
    expect(onSearchOpenChange).toHaveBeenCalledWith(true);
    // Drawn twice in a sidebar (the sidebar and the phone drawer): the host's one modal.
    rerender(<MingoChatRail {...props} searchOpen />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('MingoChatSearchModal: focuses the field, sends the term, and clears it on Escape', async () => {
    const onOpenChange = vi.fn();
    const onSearchChange = vi.fn();
    render(<MingoChatSearchModal open onOpenChange={onOpenChange} onSearchChange={onSearchChange} dialogs={DIALOGS} />);
    const input = screen.getByPlaceholderText('Search for Chats');
    await waitFor(() => expect(input).toHaveFocus());

    fireEvent.change(input, { target: { value: 'vpn' } });
    await waitFor(() => expect(onSearchChange).toHaveBeenLastCalledWith('vpn'));
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onSearchChange).toHaveBeenLastCalledWith('');
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('MingoChatSearchModal: picking a result opens it and closes the search', () => {
    const onSelectDialog = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <MingoChatSearchModal
        open
        onOpenChange={onOpenChange}
        onSearchChange={vi.fn()}
        onSelectDialog={onSelectDialog}
        dialogs={DIALOGS}
      />,
    );
    const modal = screen.getByRole('dialog');
    expect(within(modal).getByRole('heading', { name: 'Search chats' })).toBeInTheDocument();
    fireEvent.click(within(modal).getByRole('button', { name: 'osquery check' }));
    expect(onSelectDialog).toHaveBeenCalledWith('a');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps its own search state without a host one', async () => {
    render(<MingoChatRail variant="section" dialogs={DIALOGS} onSearchChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Search chats' }));
    const input = screen.getByPlaceholderText('Search for Chats');
    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByPlaceholderText('Search for Chats')).not.toBeInTheDocument());
  });

  it('derives someone else’s chat from owner.id and the viewer’s id', () => {
    render(
      <MingoChatRail
        variant="section"
        currentUserId="u-me"
        dialogs={[
          { id: 'mine', title: 'My chat', owner: { id: 'u-me', name: 'Pavlo Shylo' } },
          { id: 'theirs', title: 'Their chat', owner: { id: 'u-roman', name: 'Roman Smith' } },
          { id: 'unknown', title: 'Old chat', owner: { name: 'Ann Lee' } },
        ]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Owner: Roman Smith' })).toHaveTextContent('RS');
    expect(screen.queryByRole('img', { name: 'Owner: Pavlo Shylo' })).not.toBeInTheDocument();
    // No owner id: taken as the viewer's, never a stranger's initials on a guess.
    expect(screen.queryByRole('img', { name: 'Owner: Ann Lee' })).not.toBeInTheDocument();
  });

  it('lets the host’s ownedByOther win over the ids', () => {
    render(
      <MingoChatRail
        variant="section"
        currentUserId="u-me"
        ownedByOther={dialog => dialog.id === 'mine'}
        dialogs={[
          { id: 'mine', title: 'My chat', owner: { id: 'u-me', name: 'Pavlo Shylo' } },
          { id: 'theirs', title: 'Their chat', owner: { id: 'u-roman', name: 'Roman Smith' } },
        ]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Owner: Pavlo Shylo' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Owner: Roman Smith' })).not.toBeInTheDocument();
  });

  it('switches the scope from the filter menu, and lights the filter while all chats show', () => {
    const onScopeChange = vi.fn();
    const { rerender } = render(
      <MingoChatRail variant="section" dialogs={[]} scope="my" onScopeChange={onScopeChange} />,
    );
    // Offered on an empty "My Chats" too.
    expect(screen.getByText('No Current Chats')).toBeInTheDocument();
    const filter = screen.getByRole('button', { name: 'Filter chats' });
    expect(filter).not.toHaveClass('text-ods-accent');
    fireEvent.pointerDown(filter, { button: 0, pointerType: 'mouse' });
    expect(screen.getByRole('menuitemradio', { name: 'My chats' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'All chats' }));
    expect(onScopeChange).toHaveBeenCalledWith('all');

    rerender(<MingoChatRail variant="section" dialogs={[]} scope="all" onScopeChange={onScopeChange} />);
    expect(screen.getByRole('button', { name: 'Filter chats' })).toHaveClass('text-ods-accent');
  });

  it('loads the next page when the end of the list shows, once per page', () => {
    // The observers alive now; a disconnected one never reports again.
    const live = new Set<IntersectionObserverCallback>();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        private readonly callback: IntersectionObserverCallback;
        constructor(callback: IntersectionObserverCallback) {
          this.callback = callback;
        }
        observe() {
          live.add(this.callback);
        }
        disconnect() {
          live.delete(this.callback);
        }
        unobserve() {}
        takeRecords() {
          return [];
        }
      },
    );
    const onLoadMore = vi.fn();
    const visible = () =>
      act(() => {
        for (const notify of live)
          notify([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
      });
    const { rerender } = render(<MingoChatRail variant="section" dialogs={DIALOGS} hasMore onLoadMore={onLoadMore} />);
    visible();
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    rerender(<MingoChatRail variant="section" dialogs={DIALOGS} hasMore isLoadingMore onLoadMore={onLoadMore} />);
    visible();
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    rerender(<MingoChatRail variant="section" dialogs={DIALOGS} hasMore={false} onLoadMore={onLoadMore} />);
    visible();
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('watches the end of the list against the viewport, so the sidebar body may scroll it too', () => {
    // A root on the list would see the sentinel in view for good: the sidebar
    // body scrolls the list at full height. The viewport clips by the body.
    const options: IntersectionObserverInit[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(_callback: IntersectionObserverCallback, init: IntersectionObserverInit) {
          options.push(init);
        }
        observe() {}
        disconnect() {}
        unobserve() {}
        takeRecords() {
          return [];
        }
      },
    );
    render(<MingoChatRail variant="section" dialogs={DIALOGS} hasMore onLoadMore={vi.fn()} />);
    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({
      root: null,
      rootMargin: '0px 0px 600px 0px',
      scrollMargin: '0px 0px 600px 0px',
    });
  });

  it('shows the loading, failed and empty states', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<MingoChatRail variant="section" dialogs={[]} isLoadingHistory />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading chats');

    rerender(
      <MingoChatRail variant="section" dialogs={[]} loadError onRetry={onRetry} scope="all" onScopeChange={vi.fn()} />,
    );
    expect(screen.getByText('Couldn’t load your chats')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'All Chats' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(<MingoChatRail variant="section" dialogs={[]} />);
    expect(screen.getByText('No Current Chats')).toBeInTheDocument();
    expect(screen.getByText('Previous Mingo sessions will show here')).toBeInTheDocument();

    rerender(<MingoChatRail variant="section" dialogs={[]} searchQuery="nothing" />);
    expect(screen.getByText('No chats found')).toBeInTheDocument();
  });

  it('leaves the rail actions out', () => {
    render(
      <MingoChatRail
        variant="section"
        dialogs={DIALOGS}
        onNewChat={vi.fn()}
        onWhatToAsk={vi.fn()}
        onExpand={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Start New Chat' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'What to ask Mingo?' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expand chat' })).not.toBeInTheDocument();
  });
});

describe('MingoChatRail default variant', () => {
  it('is still the v2 rail', () => {
    render(<MingoChatRail dialogs={DIALOGS} onNewChat={vi.fn()} onWhatToAsk={vi.fn()} />);
    expect(screen.getByRole('complementary', { name: 'Mingo chats' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start New Chat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'What to ask Mingo?' })).toBeInTheDocument();
    expect(screen.getByText('Your Current Chats')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Chat history' })).not.toBeInTheDocument();
    // One flat list, no day groups; an untitled chat keeps the rail's own name.
    expect(screen.queryAllByRole('group')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Untitled Chat' })).toBeInTheDocument();
  });

  it('honours a host-controlled search field too', () => {
    const onSearchOpenChange = vi.fn();
    const { rerender } = render(
      <MingoChatRail
        dialogs={DIALOGS}
        onSearchChange={vi.fn()}
        searchOpen={false}
        onSearchOpenChange={onSearchOpenChange}
      />,
    );
    expect(screen.queryByPlaceholderText('Search for Chats')).not.toBeInTheDocument();
    rerender(
      <MingoChatRail dialogs={DIALOGS} onSearchChange={vi.fn()} searchOpen onSearchOpenChange={onSearchOpenChange} />,
    );
    expect(screen.getByPlaceholderText('Search for Chats')).toBeInTheDocument();
  });
});

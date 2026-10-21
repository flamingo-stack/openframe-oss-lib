import { render } from '@testing-library/react';
/**
 * The conversation lists draw their own loading state: one page of rows (the host's page size, else
 * `CHAT_HISTORY_PAGE_SIZE`), each marked `data-loading-item`, in their own box, and never a read word. The parent
 * renders the list and passes `loading` (or wraps it in a `LoadingScope`); it never picks the list's skeleton.
 */
import { describe, expect, it } from 'vitest';
import { LoadingScope } from '../../ui/loading-scope';
import { ChatArchivePage } from '../chat-archive-page';
import { ChatMessageList } from '../chat-message-list';
import { CHAT_MESSAGE_LIST_SKELETON_MESSAGES, ChatMessageSkeleton } from '../chat-message-skeleton';
import { ChatSidebar } from '../chat-sidebar';
import { CHAT_TICKET_LIST_SKELETON_ROWS, ChatTicketList } from '../chat-ticket-list';
import { ChatTopNavigation } from '../chat-top-navigation';
import { MingoArchiveList } from '../mingo-archive-list';
import { CHAT_HISTORY_PAGE_SIZE, MingoChatHistory } from '../mingo-chat-history';
import { MingoChatRail } from '../mingo-chat-rail';
import { MingoHistoryRail } from '../mingo-history-rail';
import { MingoOnboardingCard } from '../mingo-onboarding-card';
import { MingoWelcome } from '../mingo-welcome';
import { ModelDisplay } from '../model-display';
import { MspOrganizationCard } from '../msp-organization-card';

const READ = 'READ-DATA-WORD';
const DIALOGS = [
  { id: 'a', title: READ },
  { id: 'b', title: READ },
];
const PAGE = 7;

const items = (container: HTMLElement) => container.querySelectorAll('[data-loading-item]');

describe('conversation lists draw one page of their own loading rows', () => {
  const lists: Array<[string, (pageSize?: number) => React.ReactElement]> = [
    ['MingoChatHistory', pageSize => <MingoChatHistory dialogs={[]} loading pageSize={pageSize} />],
    ['MingoHistoryRail', pageSize => <MingoHistoryRail dialogs={[]} isLoadingHistory pageSize={pageSize} />],
    ['MingoChatRail', pageSize => <MingoChatRail dialogs={[]} isLoadingHistory pageSize={pageSize} />],
    ['MingoArchiveList', pageSize => <MingoArchiveList dialogs={[]} isLoading pageSize={pageSize} />],
    [
      'ChatArchivePage',
      pageSize => <ChatArchivePage embedded dialogs={[]} onSelectDialog={() => {}} isLoading pageSize={pageSize} />,
    ],
    ['ChatSidebar', pageSize => <ChatSidebar dialogs={[]} isLoading pageSize={pageSize} />],
    ['MingoWelcome', pageSize => <MingoWelcome isLoadingHistory historyPageSize={pageSize} />],
  ];

  it.each(lists)('%s draws the host page size', (_, list) => {
    const { container } = render(list(PAGE));
    expect(items(container)).toHaveLength(PAGE);
    expect(container.querySelector('.ods-skeleton')).not.toBeNull();
  });

  it.each(lists)('%s defaults to CHAT_HISTORY_PAGE_SIZE', (_, list) => {
    const { container } = render(list());
    expect(items(container)).toHaveLength(CHAT_HISTORY_PAGE_SIZE);
  });
});

describe('conversation lists in a scope draw their own skeleton, never a read word', () => {
  const lists: Array<[string, React.ReactElement]> = [
    ['MingoChatHistory', <MingoChatHistory key="a" dialogs={DIALOGS} pageSize={PAGE} />],
    ['MingoHistoryRail', <MingoHistoryRail key="a" dialogs={DIALOGS} pageSize={PAGE} />],
    ['MingoChatRail', <MingoChatRail key="a" dialogs={DIALOGS} pageSize={PAGE} />],
    ['MingoArchiveList', <MingoArchiveList key="a" dialogs={DIALOGS} pageSize={PAGE} />],
    ['ChatSidebar', <ChatSidebar key="a" dialogs={DIALOGS} pageSize={PAGE} />],
  ];

  it.each(lists)('%s', (_, list) => {
    const { container } = render(<LoadingScope>{list}</LoadingScope>);
    expect(container.textContent).not.toContain(READ);
    expect(items(container)).toHaveLength(PAGE);
  });
});

describe('loaded conversation rows are marked like their skeleton rows', () => {
  it.each([
    ['MingoChatHistory', <MingoChatHistory key="a" dialogs={DIALOGS} />],
    ['MingoChatRail', <MingoChatRail key="a" dialogs={DIALOGS} />],
    ['MingoArchiveList', <MingoArchiveList key="a" dialogs={DIALOGS} />],
    ['ChatSidebar', <ChatSidebar key="a" dialogs={DIALOGS} />],
  ])('%s', (_, list) => {
    const { container } = render(list);
    expect(items(container)).toHaveLength(DIALOGS.length);
  });
});

describe('chat parts switch themselves', () => {
  it('ChatMessageList draws its loading thread with isLoading, in the fill layout when asked', () => {
    const { container } = render(<ChatMessageList messages={[]} isLoading fullWidth fill />);
    expect(items(container)).toHaveLength(CHAT_MESSAGE_LIST_SKELETON_MESSAGES);
    expect(container.querySelector('.overflow-hidden')).not.toBeNull();
  });

  it('ChatMessageList draws the same thread in a scope, and its loaded messages carry the same marker', () => {
    const { container: scoped } = render(
      <LoadingScope>
        <ChatMessageList messages={[]} />
      </LoadingScope>,
    );
    expect(items(scoped)).toHaveLength(CHAT_MESSAGE_LIST_SKELETON_MESSAGES);
    const { container: loaded } = render(
      <ChatMessageList
        messages={[
          { id: '1', role: 'user', content: 'Hi', timestamp: new Date() },
          { id: '2', role: 'assistant', content: 'Hello', timestamp: new Date() },
        ]}
      />,
    );
    expect(items(loaded)).toHaveLength(2);
  });

  it('MingoOnboardingCard draws its skeleton while loading', () => {
    const { container } = render(<MingoOnboardingCard loading title={READ} />);
    expect(container.textContent).not.toContain(READ);
    expect(container.querySelector('.ods-skeleton')).not.toBeNull();
  });

  it('MspOrganizationCard draws its skeleton while loading', () => {
    const { container } = render(<MspOrganizationCard loading name={READ} />);
    expect(container.textContent).not.toContain(READ);
    expect(container.querySelector('.ods-skeleton')).not.toBeNull();
  });

  it('ModelDisplay draws its skeleton while loading, with the tokens tail once the context window is known', () => {
    const { container } = render(<ModelDisplay loading modelName={READ} />);
    expect(container.textContent).not.toContain(READ);
    const bars = container.querySelectorAll('.ods-skeleton').length;
    const withTail = render(<ModelDisplay loading modelName={READ} contextWindow={1000} />).container;
    expect(withTail.querySelectorAll('.ods-skeleton')).toHaveLength(bars + 1);
  });

  it('ModelDisplay in a scope draws its skeleton', () => {
    const { container } = render(
      <LoadingScope>
        <ModelDisplay modelName={READ} />
      </LoadingScope>,
    );
    expect(container.textContent).not.toContain(READ);
    expect(container.querySelector('.ods-skeleton')).not.toBeNull();
  });
});

describe('round 2: chat rows are their loaded twins', () => {
  it('a message skeleton draws the face as a 20px round box, the body as text lines, and the user turn as a bubble', () => {
    const { container } = render(<ChatMessageSkeleton isUser bodyLines={1} />);
    expect(container.querySelector('.rounded-xl.bg-ods-bg-active')).not.toBeNull();
    expect(container.querySelector('.justify-end')).not.toBeNull();
    const face = container.querySelector('.ods-skeleton.rounded-full') as HTMLElement | null;
    expect(face?.style.width).toBe('20px');
  });

  it('a message skeleton takes the v2 row padding', () => {
    const v2 = render(<ChatMessageSkeleton appearance="v2" />).container.firstElementChild?.className ?? '';
    expect(v2).toContain('py-[calc(var(--spacing-system-m)/2)]');
  });

  it('slash-command cards carry data-loading-item in both forms', () => {
    const loading = render(<MingoOnboardingCard loading data-loading-item title="" />).container;
    const loaded = render(<MingoOnboardingCard data-loading-item title="Roadmap" actions={[]} />).container;
    // The card's own frame is the list item (its typical action chips, a nested list, carry their own markers).
    expect(loading.firstElementChild?.hasAttribute('data-loading-item')).toBe(true);
    expect(loaded.firstElementChild?.hasAttribute('data-loading-item')).toBe(true);
  });

  it('the ticket list switches on the scope and marks its rows', () => {
    const { container } = render(
      <LoadingScope>
        <ChatTicketList tickets={[]} />
      </LoadingScope>,
    );
    expect(items(container)).toHaveLength(CHAT_TICKET_LIST_SKELETON_ROWS);
  });

  it('the MSP footer draws its own loading form, its caption real', () => {
    const { container } = render(<MspOrganizationCard variant="footer" loading name={READ} />);
    expect(container.textContent).toContain('Your IT is managed by');
    expect(container.textContent).not.toContain(READ);
  });

  it('the archive draws its loading list while the first page is in flight, never nothing', () => {
    const { container } = render(<ChatArchivePage embedded dialogs={[]} onSelectDialog={() => {}} isFetching />);
    expect(items(container).length).toBeGreaterThan(0);
  });

  it('the top navigation switches on the scope; no subtitle bar when it has no subtitle', () => {
    const withSub = render(
      <LoadingScope>
        <ChatTopNavigation name={READ} subtitle="" />
      </LoadingScope>,
    ).container;
    const without = render(
      <LoadingScope>
        <ChatTopNavigation name={READ} />
      </LoadingScope>,
    ).container;
    expect(withSub.textContent).not.toContain(READ);
    expect(without.querySelectorAll('.ods-skeleton').length).toBeLessThan(
      withSub.querySelectorAll('.ods-skeleton').length,
    );
  });
});

/**
 * The compact chat row (`ChatListItem size="compact"`, `MingoChatHistorySection
 * density="compact"`): the three-column shell's 32px row with a 14px title and
 * the open chat on the shell's tint.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatListItem } from '../chat-nav-sidebar';
import { MingoChatHistorySection } from '../mingo-chat-history-section';

describe('ChatListItem size', () => {
  it('compact: 32px row, 14px title, the tint when selected', () => {
    render(<ChatListItem title="Check devices" size="compact" active />);
    const row = screen.getByRole('button', { name: /Check devices/ });
    expect(row).toHaveClass('h-8', 'data-[tone=accent]:data-[state=active]:bg-ods-accent-tint');
    expect(screen.getByText('Check devices')).toHaveClass('text-h6', 'text-ods-accent');
  });

  it('default: the 18px title, no tint', () => {
    render(<ChatListItem title="Check devices" />);
    expect(screen.getByRole('button', { name: /Check devices/ })).not.toHaveClass('h-8');
    expect(screen.getByText('Check devices')).toHaveClass('text-h4');
  });
});

describe('MingoChatHistorySection density', () => {
  it('draws compact rows and marks the open chat', () => {
    render(
      <MingoChatHistorySection
        density="compact"
        dialogs={[
          { id: 'a', title: 'Check devices', timestamp: new Date() },
          { id: 'b', title: 'RMM alert tuning', timestamp: new Date() },
        ]}
        activeDialogId="a"
      />,
    );
    expect(screen.getByText('Check devices')).toHaveClass('text-h6', 'text-ods-accent');
    expect(screen.getByText('RMM alert tuning')).toHaveClass('text-h6', 'text-ods-text-primary');
  });
});

describe('MingoChatHistorySection compact caption', () => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 26 * 60 * 60 * 1000);
  const dialogs = [
    { id: 'a', title: 'Check devices', timestamp: now },
    { id: 'b', title: 'RMM alert tuning', timestamp: yesterday },
  ];

  it('captions today as "Current chats" and keeps the other days', () => {
    render(<MingoChatHistorySection density="compact" dialogs={dialogs} />);
    expect(screen.getByRole('heading', { name: 'Current chats' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Chat history' })).not.toBeInTheDocument();
    // Today's label stays for assistive tech only; the next day keeps its own.
    expect(screen.getByText('Today')).toHaveClass('sr-only');
    expect(screen.getByText('Yesterday')).not.toHaveClass('sr-only');
  });

  it('folds the scope into ⋯: no filter button of its own', () => {
    render(
      <MingoChatHistorySection
        density="compact"
        dialogs={dialogs}
        scope="my"
        onScopeChange={() => undefined}
        onOpenArchive={() => undefined}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Filter chats' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('keeps the default caption and the filter button', () => {
    render(<MingoChatHistorySection dialogs={dialogs} scope="my" onScopeChange={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Chat history' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter chats' })).toBeInTheDocument();
  });
});

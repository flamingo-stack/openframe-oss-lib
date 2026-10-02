import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MingoChatHeader } from '../mingo-chat-header';
import { MingoChatRail } from '../mingo-chat-rail';

const DIALOGS = [
  { id: 'a', title: 'osquery check' },
  { id: 'b', title: 'Patch reports', unreadMessagesCount: 2 },
  { id: 'c', title: 'RMM alert tuning' },
];

describe('MingoChatRail', () => {
  it('lists the chats with the selected one marked and their status at the end', () => {
    render(
      <MingoChatRail
        dialogs={DIALOGS}
        activeDialogId="a"
        onNewChat={vi.fn()}
        statusOf={dialog => (dialog.id === 'c' ? 'approval' : undefined)}
      />,
    );
    expect(screen.getByRole('button', { name: 'osquery check' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('img', { name: 'New reply' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Waiting for approval' })).toBeInTheDocument();
  });

  it('offers only the actions it has handlers for', () => {
    const onNewChat = vi.fn();
    render(<MingoChatRail dialogs={DIALOGS} onNewChat={onNewChat} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start New Chat' }));
    expect(onNewChat).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Chat Archive' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chat list options' })).not.toBeInTheDocument();
  });

  it('selects a chat', () => {
    const onSelectDialog = vi.fn();
    render(<MingoChatRail dialogs={DIALOGS} onSelectDialog={onSelectDialog} />);
    fireEvent.click(screen.getByRole('button', { name: 'RMM alert tuning' }));
    expect(onSelectDialog).toHaveBeenCalledWith('c');
  });

  it('shows the empty state without chats', () => {
    render(<MingoChatRail dialogs={[]} />);
    expect(screen.getByText('No Current Chats')).toBeInTheDocument();
  });
});

describe('MingoChatHeader', () => {
  it('renders only the controls it is given', () => {
    const onToggleList = vi.fn();
    const onCollapse = vi.fn();
    render(
      <MingoChatHeader
        title="Check new device"
        subtitle="Roman Smith"
        onToggleList={onToggleList}
        listOpen
        onCollapse={onCollapse}
      />,
    );
    expect(screen.getByText('Roman Smith')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hide chat list' }));
    fireEvent.click(screen.getByRole('button', { name: 'Collapse chat' }));
    expect(onToggleList).toHaveBeenCalledTimes(1);
    expect(onCollapse).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chat actions' })).not.toBeInTheDocument();
  });
});

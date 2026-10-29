import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatArchivePage } from '../chat-archive-page';
import { ChatPanelHeader } from '../chat-panel-header';

describe('chat headers without a close handler', () => {
  it('ChatPanelHeader leaves the close button out', () => {
    render(<ChatPanelHeader title="Current Chats" />);
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close chat' })).not.toBeInTheDocument();
  });

  it('ChatPanelHeader keeps it when there is one', () => {
    render(<ChatPanelHeader title="Current Chats" onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('ChatArchivePage keeps Back and drops Close', () => {
    render(<ChatArchivePage dialogs={[]} onSelectDialog={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getAllByRole('button', { name: 'Back' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });
});

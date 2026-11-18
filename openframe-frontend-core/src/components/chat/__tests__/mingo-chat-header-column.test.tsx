import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MingoChatHeader } from '../mingo-chat-header';

/** The bar's own opening tag (its first element), read from the markup: no node access. */
const barTag = () => /^<div[^>]*>/.exec(document.body.firstElementChild?.innerHTML ?? '')?.[0] ?? '';

describe('MingoChatHeader look="column"', () => {
  const header = (look?: 'default' | 'column') => (
    <MingoChatHeader
      variant="page"
      look={look}
      title="Check new device"
      meta={['Ada Lovelace', 'Today']}
      avatar={{ name: 'Ada Lovelace' }}
      menuItems={[{ id: 'rename', label: 'Rename Chat', onClick: vi.fn() }]}
      actions={[{ id: 'close-chat', label: 'Close chat', icon: <svg />, onClick: vi.fn() }]}
    />
  );

  it('is the work-area chat column header: panel surface, the title alone, the owner in a cell', () => {
    render(header('column'));
    expect(barTag()).toContain('data-look="column"');
    for (const name of ['bg-ods-panel', 'border-ods-border-panel', 'ods-viewport-layer'])
      expect(barTag()).toContain(name);
    expect(screen.getByText('Check new device')).toHaveClass('text-shell-body');
    // No "· owner · day": the owner is the avatar.
    expect(screen.queryByText(/· Ada Lovelace/)).not.toBeInTheDocument();
    expect(screen.getByTitle('Ada Lovelace')).toBeInTheDocument();
    // The chat's ⋯ and the host's cells, 20px glyphs.
    expect(screen.getByRole('button', { name: 'Chat actions' })).toHaveClass('[&_svg]:h-5');
    expect(screen.getByRole('button', { name: 'Close chat' })).toHaveClass('border-l', '[&_svg]:h-5');
  });

  it('keeps the page bar as it was by default', () => {
    render(header());
    expect(barTag()).not.toContain('data-look');
    expect(barTag()).toContain('divide-x');
    expect(screen.getByText('· Ada Lovelace · Today')).toBeInTheDocument();
    expect(screen.queryByTitle('Ada Lovelace')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close chat' })).not.toHaveClass('[&_svg]:h-5');
  });
});

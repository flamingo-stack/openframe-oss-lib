import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionsMenu, ActionsMenuDropdown } from '../actions-menu';

const scope = (checked: 'my' | 'all', onPick: (scope: 'my' | 'all') => void = vi.fn()) => [
  { id: 'my', label: 'My chats', type: 'radio' as const, checked: checked === 'my', onClick: () => onPick('my') },
  { id: 'all', label: 'All chats', type: 'radio' as const, checked: checked === 'all', onClick: () => onPick('all') },
];

describe('ActionsMenu radio items', () => {
  it('draws a choice of one: menuitemradio, checked on the chosen item only', () => {
    render(<ActionsMenu groups={[{ items: scope('all') }]} />);
    expect(screen.getByRole('menuitemradio', { name: 'All chats' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'My chats' })).toHaveAttribute('aria-checked', 'false');
  });

  it('closes the dropdown on a pick, unlike a checkbox', () => {
    const onPick = vi.fn();
    render(<ActionsMenuDropdown triggerAriaLabel="Filter" groups={[{ items: scope('my', onPick) }]} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Filter' }), { button: 0, pointerType: 'mouse' });
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'All chats' }));
    expect(onPick).toHaveBeenCalledWith('all');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

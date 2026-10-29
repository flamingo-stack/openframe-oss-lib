import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NavigationSidebarItem } from '../../../types/navigation';
import { MobileBurgerMenu } from '../mobile-burger-menu';

const icon = <svg />;

const items: NavigationSidebarItem[] = [
  {
    id: 'inventory',
    label: 'Inventory',
    icon,
    children: [
      { id: 'customers', label: 'Customers', icon, path: '/customers' },
      { id: 'devices', label: 'Devices', icon, path: '/devices' },
    ],
  },
  {
    id: 'automation',
    label: 'Automation',
    icon,
    children: [{ id: 'scripts', label: 'Scripts', icon, path: '/scripts' }],
  },
  { id: 'kb', label: 'Knowledge Base', icon, path: '/knowledge-base', section: 'secondary' },
];

describe('MobileBurgerMenu grouped', () => {
  it('draws the tree with the active group open, plus the section and footer slots', () => {
    render(
      <MobileBurgerMenu
        isOpen
        onClose={vi.fn()}
        config={{
          variant: 'grouped',
          items,
          currentPath: '/devices',
          sectionSlot: <p>Chat history</p>,
          footerSlot: ({ minimized, inDrawer }) => (
            <span>{minimized ? 'rail' : inDrawer ? 'account row' : 'sidebar'}</span>
          ),
        }}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Mobile navigation menu' });
    expect(within(dialog).getByRole('button', { name: 'Inventory' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(dialog).getByRole('link', { name: 'Devices' })).toHaveAttribute('aria-current', 'page');
    expect(within(dialog).getByText('Chat history')).toBeInTheDocument();
    expect(within(dialog).getByText('account row')).toBeInTheDocument();
  });

  it('insets the rows by one padding all round, as the sidebar does', () => {
    render(
      <MobileBurgerMenu isOpen onClose={vi.fn()} config={{ variant: 'grouped', items, currentPath: '/devices' }} />,
    );
    expect(document.body.innerHTML).toMatch(/class="[^"]*overscroll-contain p-\[var\(--spacing-system-xsf\)\]"/);
    expect(document.body.innerHTML).not.toContain('overscroll-contain px-');
  });

  it('holds the section slot only while open, and through the closing slide', () => {
    vi.useFakeTimers();
    try {
      const menu = (isOpen: boolean) => (
        <MobileBurgerMenu
          isOpen={isOpen}
          onClose={vi.fn()}
          config={{ variant: 'grouped', items, currentPath: '/devices', sectionSlot: <p>Chat history</p> }}
        />
      );
      const { rerender } = render(menu(false));
      // Closed, the drawer is still mounted: a second copy of the history would be too.
      expect(screen.queryByText('Chat history')).not.toBeInTheDocument();

      rerender(menu(true));
      expect(screen.getByText('Chat history')).toBeInTheDocument();

      rerender(menu(false));
      act(() => {
        vi.advanceTimersByTime(299);
      });
      expect(screen.getByText('Chat history')).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(screen.queryByText('Chat history')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a parent only expands (the menu stays open); a child navigates and closes', () => {
    const onClose = vi.fn();
    const onNavigate = vi.fn();
    render(
      <MobileBurgerMenu
        isOpen
        onClose={onClose}
        config={{ variant: 'grouped', items, currentPath: '/devices', onNavigate }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Automation' }));
    expect(onNavigate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Automation' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Inventory' })).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(screen.getByRole('link', { name: 'Scripts' }));
    expect(onNavigate).toHaveBeenCalledWith('/scripts');
    expect(onClose).toHaveBeenCalled();
  });

  it('leaves a flat config as the card grid', () => {
    render(
      <MobileBurgerMenu
        isOpen
        onClose={vi.fn()}
        config={{
          items: [
            { id: 'dashboard', label: 'Dashboard', icon, path: '/dashboard', isActive: true },
            { id: 'devices', label: 'Devices', icon, path: '/devices' },
          ],
        }}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(within(nav).getByRole('button', { name: 'Devices' })).toHaveAttribute('data-tone', 'framed');
    expect(
      within(nav)
        .getAllByRole('button')
        .map(button => button.textContent),
    ).toEqual(['Dashboard', 'Devices']);
    expect(within(nav).getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  });
});

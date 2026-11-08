/**
 * The three-column shell's phone chrome: the burger at the end with Mingo at the start
 * (`AppHeader` `mobileMenuSide="end"`), the panel ground, and the sectioned navigation
 * as a drawer from the right (`MobileBurgerMenu`).
 */

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NavigationSidebarItem } from '../../../types/navigation';
import { AppHeader } from '../app-header';
import { MobileBurgerMenu } from '../mobile-burger-menu';

const icon = <svg />;

describe('AppHeader mobileMenuSide', () => {
  const buttons = () => within(screen.getByRole('banner')).getAllByRole('button');
  const last = () => buttons()[buttons().length - 1];

  it('puts the burger first and Mingo last by default', () => {
    render(<AppHeader isMobileMenuOpen={false} showMingoAI onMingoAI={vi.fn()} onToggleMobileMenu={vi.fn()} />);
    expect(buttons()[0]).toHaveAccessibleName('Open menu');
    expect(last()).toHaveAccessibleName(/Mingo/);
  });

  it('swaps them with "end", on the panel ground with surface="panel"', () => {
    render(
      <AppHeader
        isMobileMenuOpen={false}
        showMingoAI
        onMingoAI={vi.fn()}
        onToggleMobileMenu={vi.fn()}
        mobileMenuSide="end"
        surface="panel"
      />,
    );
    expect(buttons()[0]).toHaveAccessibleName(/Mingo/);
    expect(last()).toHaveAccessibleName('Open menu');
    expect(screen.getAllByRole('button', { name: /Mingo/ })).toHaveLength(1);
    expect(screen.getByRole('banner')).toHaveClass('bg-ods-panel');
  });
});

describe('MobileBurgerMenu sectioned', () => {
  const items: NavigationSidebarItem[] = [
    {
      id: 'fleet',
      label: 'Fleet',
      icon,
      children: [
        { id: 'customers', label: 'Customers', icon, path: '/customers' },
        { id: 'devices', label: 'Devices', icon, path: '/devices' },
      ],
    },
    { id: 'settings', label: 'Settings', icon, path: '/settings', section: 'secondary' },
  ];

  it("draws the sidebar's sections from the right, on the panel ground", () => {
    render(
      <MobileBurgerMenu
        isOpen
        onClose={vi.fn()}
        config={{ variant: 'sectioned', surface: 'panel', side: 'right', items, currentPath: '/devices' }}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Mobile navigation menu' });
    expect(dialog).toHaveClass('right-0', 'bg-ods-panel');
    expect(within(dialog).getByRole('link', { name: 'Devices' })).toHaveAttribute('aria-current', 'page');
    expect(within(dialog).getByRole('link', { name: 'Settings' })).toBeInTheDocument();
  });

  it("takes the navigation's own width", () => {
    render(
      <MobileBurgerMenu
        isOpen
        onClose={vi.fn()}
        config={{ variant: 'sectioned', side: 'right', expandedWidth: 200, items, currentPath: '/devices' }}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Mobile navigation menu' });
    expect(dialog).toHaveStyle({ width: '200px' });
    expect(dialog).not.toHaveClass('w-[300px]');
  });

  it('slides out to the right when closed', () => {
    render(
      <MobileBurgerMenu
        isOpen={false}
        onClose={vi.fn()}
        config={{ variant: 'sectioned', side: 'right', items, currentPath: '/devices' }}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Mobile navigation menu', hidden: true })).toHaveClass(
      'translate-x-full',
    );
  });
});

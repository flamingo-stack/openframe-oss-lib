import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { NavigationSidebarItem } from '../../../types/navigation';
import { AccountPopover } from '../account-popover';
import { HeaderButton } from '../header-button';
import { NavigationSidebar } from '../navigation-sidebar';
import { NavigationSidebarActionRow } from '../navigation-sidebar-grouped';

/**
 * Collapsing or expanding the grouped sidebar must not move an icon sideways: every
 * row keeps one left inset at both widths, and no step of the rail's 140px container
 * query (`@[140px]/of-nav-sidebar:`) changes it.
 */
function expectIconLineHeld(row: HTMLElement) {
  expect(row).toHaveClass('pl-[var(--spacing-system-xsf)]');
  expect(row.className).not.toMatch(/of-nav-sidebar:(px|pl)-/);
}

const icon = <svg data-testid="icon" />;

const items: NavigationSidebarItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon, path: '/dashboard' },
  {
    id: 'inventory',
    label: 'Inventory',
    icon,
    children: [{ id: 'customers', label: 'Customers', icon, path: '/customers' }],
  },
];

beforeEach(() => {
  window.localStorage.clear();
});

describe('Grouped navigation sidebar — the icon line', () => {
  it('holds every row of the tree and the toggle 8px in at both widths', () => {
    render(<NavigationSidebar config={{ variant: 'grouped', items, currentPath: '/customers' }} />);
    expectIconLineHeld(screen.getByRole('link', { name: 'Dashboard' }));
    expectIconLineHeld(screen.getByRole('button', { name: 'Inventory' }));
    expectIconLineHeld(screen.getByRole('button', { name: 'Hide Menu' }));
    // A child's icon column stays flush under its parent's icon.
    expect(screen.getByRole('link', { name: 'Customers' }).className).not.toMatch(/\bpl-|of-nav-sidebar:pl-/);
  });

  it("rounds an open group's parent row as the inside of its card's border", () => {
    render(<NavigationSidebar config={{ variant: 'grouped', items, currentPath: '/customers' }} />);
    const parent = screen.getByRole('button', { name: 'Inventory' });
    expect(parent).toHaveAttribute('aria-expanded', 'true');
    expect(parent).toHaveClass('rounded-[calc(var(--radius)-3px)]', 'after:rounded-[calc(var(--radius)-3px)]');
    expect(parent).not.toHaveClass('rounded-md');
  });

  it('insets the rows by one padding all round', () => {
    render(<NavigationSidebar config={{ variant: 'grouped', items, currentPath: '/dashboard' }} />);
    // The scrolling body around the rows: one class for the four sides, no side of its own.
    expect(document.body.innerHTML).toContain(
      'class="flex flex-1 flex-col justify-between overflow-y-auto p-[var(--spacing-system-xsf)]"',
    );
  });

  it('holds an action row, the account and a compact foot button on the same line', () => {
    render(
      <>
        <NavigationSidebarActionRow icon={icon} label="New chat" variant="outline" onClick={() => {}} />
        <AccountPopover collapsed name="Ada Lovelace" items={[]} />
        <HeaderButton size="compact" icon={icon} aria-label="Notifications" />
      </>,
    );
    expectIconLineHeld(screen.getByRole('button', { name: 'New chat' }));
    expectIconLineHeld(screen.getByRole('button', { name: 'Account: Ada Lovelace' }));
    // In the rail a foot button is a row's cell with its glyph on the line; from 140px it is a
    // 32px icon button beside the account, off the tree's line by design.
    expect(screen.getByRole('button', { name: 'Notifications' })).toHaveClass(
      'justify-start',
      'pl-[var(--spacing-system-xsf)]',
      '@[140px]/of-nav-sidebar:justify-center',
    );
  });
});

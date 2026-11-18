/**
 * A sidebar on the right edge (`side`), without its logo row (`header`) or its
 * toggle row (`toggle`), and with several groups open at once (`groupMode`).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NavigationSidebarConfig, NavigationSidebarItem } from '../../../types/navigation';
import {
  NAVIGATION_SIDEBAR_END_WIDTH_VAR,
  NAVIGATION_SIDEBAR_WIDTH_VAR,
  NavigationSidebar,
} from '../navigation-sidebar';

const icon = <svg />;

function desktop() {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    query =>
      ({
        matches: query === '(min-width: 800px)' || query === '(min-width: 1280px)',
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

const groups: NavigationSidebarItem[] = [
  {
    id: 'service-desk',
    label: 'Service Desk',
    icon,
    children: [{ id: 'tickets', label: 'Tickets', icon, path: '/tickets' }],
  },
  {
    id: 'fleet',
    label: 'Fleet',
    icon,
    children: [{ id: 'devices', label: 'Devices', icon, path: '/devices' }],
  },
];

function renderSidebar(config: Partial<NavigationSidebarConfig> = {}) {
  return render(<NavigationSidebar config={{ variant: 'grouped', items: groups, ...config }} />);
}

const sidebar = () => screen.getByRole('complementary', { name: 'Main navigation sidebar' });
const groupButton = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  window.localStorage.clear();
  desktop();
});
afterEach(() => vi.restoreAllMocks());

describe('NavigationSidebar side', () => {
  it('stands on the left by default and publishes the start width property', () => {
    renderSidebar({ expandedWidth: 200 });
    expect(sidebar()).toHaveClass('border-r');
    expect(sidebar().style.getPropertyValue(NAVIGATION_SIDEBAR_WIDTH_VAR)).toBe('200px');
    expect(sidebar().style.getPropertyValue(NAVIGATION_SIDEBAR_END_WIDTH_VAR)).toBe('');
  });

  it('on the right: border on its left edge, its own width property, the right tablet edge', () => {
    renderSidebar({ side: 'right', expandedWidth: 200 });
    expect(sidebar()).toHaveClass('border-l', 'md:right-0');
    expect(sidebar()).not.toHaveClass('border-r', 'md:left-0');
    expect(sidebar().style.getPropertyValue(NAVIGATION_SIDEBAR_END_WIDTH_VAR)).toBe('200px');
    expect(sidebar().style.getPropertyValue(NAVIGATION_SIDEBAR_WIDTH_VAR)).toBe('');
  });

  it('puts a right sidebar resize handle on its left edge', () => {
    renderSidebar({
      side: 'right',
      expandedWidth: 200,
      resizable: { minWidth: 160, maxWidth: 320 },
    });
    expect(screen.getByRole('separator', { name: 'Resize navigation sidebar' })).toHaveClass('right-full');
  });
});

describe('NavigationSidebar header and toggle', () => {
  it('draws the logo row and the toggle row by default', () => {
    renderSidebar();
    expect(screen.getByRole('button', { name: 'Hide Menu' })).toBeInTheDocument();
  });

  it('leaves the toggle out with toggle: none', () => {
    renderSidebar({ toggle: 'none' });
    expect(screen.queryByRole('button', { name: 'Hide Menu' })).not.toBeInTheDocument();
  });
});

describe('NavigationSidebar groupMode', () => {
  it('keeps one group open at a time by default', () => {
    renderSidebar();
    fireEvent.click(groupButton('Service Desk'));
    fireEvent.click(groupButton('Fleet'));
    expect(groupButton('Service Desk')).toHaveAttribute('aria-expanded', 'false');
    expect(groupButton('Fleet')).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens and folds each group on its own with multi', () => {
    renderSidebar({ groupMode: 'multi' });
    fireEvent.click(groupButton('Service Desk'));
    fireEvent.click(groupButton('Fleet'));
    expect(groupButton('Service Desk')).toHaveAttribute('aria-expanded', 'true');
    expect(groupButton('Fleet')).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(groupButton('Service Desk'));
    expect(groupButton('Service Desk')).toHaveAttribute('aria-expanded', 'false');
    expect(groupButton('Fleet')).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens the active page group without closing the others', () => {
    const { rerender } = render(
      <NavigationSidebar config={{ variant: 'grouped', items: groups, groupMode: 'multi', currentPath: '/tickets' }} />,
    );
    expect(groupButton('Service Desk')).toHaveAttribute('aria-expanded', 'true');
    rerender(
      <NavigationSidebar config={{ variant: 'grouped', items: groups, groupMode: 'multi', currentPath: '/devices' }} />,
    );
    expect(groupButton('Service Desk')).toHaveAttribute('aria-expanded', 'true');
    expect(groupButton('Fleet')).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps the open set under groupsStorageKey and restores it after mount', () => {
    const { unmount } = renderSidebar({ groupMode: 'multi', groupsStorageKey: 'test.groups' });
    fireEvent.click(groupButton('Fleet'));
    expect(JSON.parse(window.localStorage.getItem('test.groups') ?? 'null')).toEqual(['fleet']);
    unmount();
    renderSidebar({ groupMode: 'multi', groupsStorageKey: 'test.groups' });
    expect(groupButton('Fleet')).toHaveAttribute('aria-expanded', 'true');
    expect(groupButton('Service Desk')).toHaveAttribute('aria-expanded', 'false');
  });
});

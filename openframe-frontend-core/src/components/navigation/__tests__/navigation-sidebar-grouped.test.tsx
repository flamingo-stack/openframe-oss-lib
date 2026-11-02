import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NavigationSidebarConfig, NavigationSidebarItem } from '../../../types/navigation';
import { NavigationSidebar } from '../navigation-sidebar';

const icon = <svg data-testid="icon" />;

function groupedItems(): NavigationSidebarItem[] {
  return [
    { id: 'dashboard', label: 'Dashboard', icon, path: '/dashboard' },
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
      children: [
        { id: 'scripts', label: 'Scripts', icon, path: '/scripts' },
        { id: 'schedules', label: 'Schedules', icon, path: '/scripts/schedules' },
        {
          id: 'policies',
          label: 'Policies',
          icon,
          path: '/monitoring?tab=policies',
          match: { path: '/monitoring', query: { tab: 'policies' } },
        },
        {
          id: 'queries',
          label: 'Queries',
          icon,
          path: '/monitoring?tab=queries',
          match: { path: '/monitoring', query: { tab: ['queries', null] } },
        },
      ],
    },
    { id: 'kb', label: 'Knowledge Base', icon, path: '/knowledge-base', section: 'secondary' },
  ];
}

/** A host that commits every navigation straight away, like a router would. */
function Host({
  initialPath,
  onNavigate,
  extra,
}: {
  initialPath: string;
  onNavigate?: (path: string) => void;
  extra?: Partial<NavigationSidebarConfig>;
}) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  return (
    <NavigationSidebar
      config={{
        variant: 'grouped',
        items: groupedItems(),
        currentPath,
        onNavigate: path => {
          onNavigate?.(path);
          setCurrentPath(path);
        },
        ...extra,
      }}
    />
  );
}

const parent = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('NavigationSidebar grouped — active resolution', () => {
  it('marks the active child, not its sibling on a shorter path', () => {
    render(<Host initialPath="/scripts/schedules" />);
    expect(screen.getByRole('link', { name: 'Schedules' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Scripts' })).not.toHaveAttribute('aria-current');
  });

  it('tells two tabs of one page apart by their query', () => {
    render(<Host initialPath="/monitoring?tab=policies" />);
    expect(screen.getByRole('link', { name: 'Policies' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Queries' })).not.toHaveAttribute('aria-current');
  });

  it('opens the group holding the active page, with its parent but no pill on it', () => {
    render(<Host initialPath="/devices" />);
    expect(parent('Inventory')).toHaveAttribute('aria-expanded', 'true');
    expect(parent('Inventory')).not.toHaveAttribute('aria-current');
    expect(parent('Automation')).toHaveAttribute('aria-expanded', 'false');
    const group = screen.getByRole('group', { name: 'Inventory' });
    expect(
      within(group)
        .getAllByRole('link')
        .map(link => link.textContent),
    ).toEqual(['Customers', 'Devices']);
    // A folded group stays mounted, so it can fold and open as a motion — inert.
    expect(group).not.toHaveAttribute('inert');
    expect(screen.getByRole('group', { name: 'Automation' })).toHaveAttribute('inert');
  });
});

describe('NavigationSidebar grouped — one open group', () => {
  it('a closed parent only opens, going nowhere; the other group closes', () => {
    const onNavigate = vi.fn();
    render(<Host initialPath="/devices" onNavigate={onNavigate} />);

    fireEvent.click(parent('Automation'));

    expect(onNavigate).not.toHaveBeenCalled();
    expect(parent('Automation')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('group', { name: 'Automation' })).not.toHaveAttribute('inert');
    expect(parent('Inventory')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('link', { name: 'Devices' })).toHaveAttribute('aria-current', 'page');
  });

  it('an open parent folds, keeping focus on the same button', () => {
    const onNavigate = vi.fn();
    render(<Host initialPath="/devices" onNavigate={onNavigate} />);
    const button = parent('Inventory');
    button.focus();

    fireEvent.click(button);

    expect(onNavigate).not.toHaveBeenCalled();
    expect(parent('Inventory')).toBe(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
    expect(screen.getByRole('group', { name: 'Inventory' })).toHaveAttribute('inert');
  });

  it('re-opening the folded group of the current page does not navigate away from it', () => {
    const onNavigate = vi.fn();
    render(<Host initialPath="/devices" onNavigate={onNavigate} />);

    fireEvent.click(parent('Inventory'));
    fireEvent.click(parent('Inventory'));

    expect(onNavigate).not.toHaveBeenCalled();
    expect(parent('Inventory')).toHaveAttribute('aria-expanded', 'true');
  });

  it('navigating to a top-level entry closes every group', () => {
    render(<Host initialPath="/devices" />);
    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
    expect(parent('Inventory')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  });

  it('marks a clicked child pending until the route commits, never active', () => {
    const onNavigate = vi.fn();
    // A host whose router has not committed yet: `currentPath` does not move.
    render(
      <NavigationSidebar config={{ variant: 'grouped', items: groupedItems(), currentPath: '/devices', onNavigate }} />,
    );
    const customers = screen.getByRole('link', { name: 'Customers' });
    fireEvent.click(customers);
    expect(onNavigate).toHaveBeenCalledWith('/customers');
    expect(customers).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Devices' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('NavigationSidebar — slots', () => {
  it('renders the section and the footer, and hands render functions `minimized`, not in the drawer', () => {
    const footer = vi.fn(({ minimized }: { minimized: boolean }) => <span>{minimized ? 'rail' : 'account'}</span>);
    render(
      <NavigationSidebar
        config={{
          variant: 'grouped',
          items: groupedItems(),
          sectionSlot: <p>Chat history</p>,
          footerSlot: footer,
        }}
      />,
    );
    expect(screen.getByText('Chat history')).toBeInTheDocument();
    expect(screen.getByText('account')).toBeInTheDocument();
    // A popup opened from the foot measures from this root's edge (the compact tracker).
    expect(screen.getByRole('complementary', { name: 'Main navigation sidebar' })).toHaveAttribute(
      'data-navigation-sidebar',
    );
    expect(footer).toHaveBeenLastCalledWith({ minimized: false, inDrawer: false });
  });

  it('hands a section render function the collapsed state', () => {
    window.localStorage.setItem('of.navigationSidebar.minimized', 'true');
    render(
      <NavigationSidebar config={{ items: [], sectionSlot: ({ minimized }) => (minimized ? 'icons only' : 'list') }} />,
    );
    expect(screen.getByText('icons only')).toBeInTheDocument();
  });
});

describe('NavigationSidebar — controlled collapse', () => {
  function Controlled({ onCollapsedChange }: { onCollapsedChange: (next: boolean) => void }) {
    const [collapsed, setCollapsed] = useState(false);
    return (
      <NavigationSidebar
        config={{
          variant: 'grouped',
          items: groupedItems(),
          collapsed,
          onCollapsedChange: next => {
            onCollapsedChange(next);
            setCollapsed(next);
          },
          footerSlot: ({ minimized }) => <span>{minimized ? 'rail' : 'full'}</span>,
        }}
      />
    );
  }

  it('follows the host value, reports toggles, and leaves the stored preference alone', () => {
    const onCollapsedChange = vi.fn();
    render(<Controlled onCollapsedChange={onCollapsedChange} />);
    expect(screen.getByText('full')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide Menu' }));

    expect(onCollapsedChange).toHaveBeenCalledWith(true);
    expect(screen.getByText('rail')).toBeInTheDocument();
    // On the rail itself: a custom property on <html> restyles the whole document.
    const rail = screen.getByRole('complementary', { name: 'Main navigation sidebar' });
    expect(rail.style.getPropertyValue('--of-navigation-sidebar-width')).toBe('56px');
    expect(document.documentElement.style.getPropertyValue('--of-navigation-sidebar-width')).toBe('');
    // `useLocalStorage` may seed its initial value; the toggle never reaches it.
    expect(window.localStorage.getItem('of.navigationSidebar.minimized')).not.toBe('true');
  });

  it('collapses when the host says so, without a click', () => {
    function Remote() {
      const [collapsed, setCollapsed] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setCollapsed(true)}>
            collapse
          </button>
          <NavigationSidebar
            config={{ items: [], collapsed, footerSlot: ({ minimized }) => (minimized ? 'rail' : 'full') }}
          />
        </>
      );
    }
    render(<Remote />);
    fireEvent.click(screen.getByRole('button', { name: 'collapse' }));
    expect(screen.getByText('rail')).toBeInTheDocument();
  });

  it('uncontrolled still persists the toggle', () => {
    render(<NavigationSidebar config={{ items: [] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hide Menu' }));
    expect(window.localStorage.getItem('of.navigationSidebar.minimized')).toBe('true');
  });
});

describe('NavigationSidebar — flat configs are unchanged', () => {
  const flat: NavigationSidebarItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon, path: '/dashboard', isActive: true },
    {
      id: 'devices',
      label: 'Devices',
      icon,
      path: '/devices',
      // Typed but never drawn by the flat sidebar.
      children: [{ id: 'hidden', label: 'Hidden child', icon, path: '/hidden', isActive: true }],
    },
    { id: 'settings', label: 'Settings', icon, path: '/settings', section: 'secondary' },
  ];

  it('draws every entry as a link row and ignores children', () => {
    render(<NavigationSidebar config={{ items: flat, onNavigate: vi.fn() }} />);
    const primary = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(
      within(primary)
        .getAllByRole('link')
        .map(link => link.getAttribute('aria-label')),
    ).toEqual(['Dashboard', 'Devices']);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByText('Hidden child')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { expanded: false })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveClass('h-14');
    expect(within(screen.getByRole('navigation', { name: 'Secondary navigation' })).getByRole('link')).toHaveAttribute(
      'href',
      '/settings',
    );
  });

  it('keeps the 56px toggle row', () => {
    render(<NavigationSidebar config={{ items: flat }} />);
    expect(screen.getByRole('button', { name: 'Hide Menu' })).toHaveClass('h-14');
  });
});

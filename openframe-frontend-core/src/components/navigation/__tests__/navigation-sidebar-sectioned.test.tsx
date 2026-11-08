/**
 * The sectioned variant (`variant: 'sectioned'`): every group a section of its own,
 * open until folded; the icon toggle (`toggle: 'icon'`); the section slot without
 * its divider (`sectionDivider: false`).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NavigationSidebarConfig, NavigationSidebarItem } from '../../../types/navigation';
import { NavigationSidebar } from '../navigation-sidebar';

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

const items: NavigationSidebarItem[] = [
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
  { id: 'settings', label: 'Settings', icon, path: '/settings', section: 'secondary' },
];

function renderSidebar(config: Partial<NavigationSidebarConfig> = {}) {
  return render(<NavigationSidebar config={{ variant: 'sectioned', items, ...config }} />);
}

const section = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  window.localStorage.clear();
  desktop();
});
afterEach(() => vi.restoreAllMocks());

describe('NavigationSidebar sectioned', () => {
  it('opens every section and draws its rows as links', () => {
    renderSidebar();
    expect(section('Service Desk')).toHaveAttribute('aria-expanded', 'true');
    expect(section('Fleet')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Tickets' })).toHaveAttribute('href', '/tickets');
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
  });

  it('folds and unfolds a section on its own and keeps the folds', () => {
    const { unmount } = renderSidebar({ groupsStorageKey: 'test.sections' });
    fireEvent.click(section('Fleet'));
    expect(section('Fleet')).toHaveAttribute('aria-expanded', 'false');
    expect(section('Service Desk')).toHaveAttribute('aria-expanded', 'true');
    // Folded rows stay mounted (the fold animates) but leave the tab order and the a11y tree.
    expect(screen.getByRole('group', { name: 'Fleet', hidden: true })).toHaveAttribute('inert');
    expect(JSON.parse(window.localStorage.getItem('test.sections') ?? 'null')).toEqual(['fleet']);
    unmount();
    renderSidebar({ groupsStorageKey: 'test.sections' });
    expect(section('Fleet')).toHaveAttribute('aria-expanded', 'false');
  });

  it('leaves no gap under a folded section', () => {
    renderSidebar();
    // The section box that holds the category button, read from the markup (no node access).
    const sectionBox = (name: string) =>
      new RegExp(`class="([^"]*)"><button[^>]*aria-label="${name}"`).exec(document.body.innerHTML)?.[1] ?? '';
    expect(sectionBox('Fleet')).not.toMatch(/\bgap-0\b/);
    fireEvent.click(section('Fleet'));
    expect(sectionBox('Fleet')).toMatch(/\bgap-0\b/);
  });

  it('marks the current page and unfolds its section', () => {
    window.localStorage.setItem('test.sections', JSON.stringify(['fleet']));
    const { rerender } = renderSidebar({ groupsStorageKey: 'test.sections', currentPath: '/tickets' });
    expect(section('Fleet')).toHaveAttribute('aria-expanded', 'false');
    rerender(
      <NavigationSidebar
        config={{ variant: 'sectioned', items, groupsStorageKey: 'test.sections', currentPath: '/devices' }}
      />,
    );
    expect(section('Fleet')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Devices' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('NavigationSidebar icon toggle', () => {
  it('draws an icon button that collapses and expands', () => {
    const onCollapsedChange = vi.fn();
    const { rerender } = renderSidebar({ toggle: 'icon', collapsed: false, onCollapsedChange });
    fireEvent.click(screen.getByRole('button', { name: 'Hide Menu' }));
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
    rerender(
      <NavigationSidebar
        config={{ variant: 'sectioned', items, toggle: 'icon', collapsed: true, onCollapsedChange }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Show Menu' })).toBeInTheDocument();
  });
});

describe('NavigationSidebar sectionDivider', () => {
  it('keeps the section slot under the tree, with or without the divider', () => {
    renderSidebar({ sectionSlot: <p>chat list</p>, sectionDivider: false });
    expect(screen.getByText('chat list')).toBeInTheDocument();
  });
});

describe('NavigationSidebar panel surface (three-column shell colours)', () => {
  const aside = () => screen.getByRole('complementary', { name: 'Main navigation sidebar' });

  it('draws the panel ground; a left panel takes the subtle border, a right one the default', () => {
    const { unmount } = renderSidebar({ surface: 'panel' });
    expect(aside()).toHaveClass('bg-ods-panel', 'border-ods-border-panel');
    unmount();
    renderSidebar({ surface: 'panel', side: 'right' });
    expect(aside()).toHaveClass('bg-ods-panel', 'border-ods-border');
    expect(aside()).not.toHaveClass('border-ods-border-panel');
  });

  it('keeps the card ground by default', () => {
    renderSidebar();
    expect(aside()).toHaveClass('bg-ods-card');
  });

  it('opens at expandedWidth', () => {
    renderSidebar({ side: 'right', expandedWidth: 200 });
    expect(aside().style.getPropertyValue('--of-navigation-sidebar-end-width')).toBe('200px');
  });

  it('marks the current page with the tint, not the grouped pill', () => {
    renderSidebar({ currentPath: '/devices' });
    const devices = screen.getByRole('link', { name: 'Devices' });
    expect(devices).toHaveClass('bg-ods-accent-tint', 'text-ods-accent');
    expect(devices).not.toHaveClass('bg-ods-accent-secondary');
    expect(screen.getByRole('link', { name: 'Tickets' })).toHaveClass('text-ods-text-primary');
  });
});

describe('NavigationSidebar sectioned icon colours (Figma rail 1408:293333)', () => {
  // The icon is the row's first child span; read it through the row's own markup.
  it('lights a section child icon in the rail only, keeps the bottom section and the category grey', () => {
    const { container } = renderSidebar();
    const html = container.innerHTML;
    // Section child (Tickets): light in the rail, grey from 140px.
    expect(html).toContain('text-ods-text-primary @[140px]/of-nav-sidebar:text-ods-text-panel-secondary');
    // Category row: grey in both widths.
    expect(section('Service Desk')).toHaveClass('text-ods-text-panel-secondary');
  });
});

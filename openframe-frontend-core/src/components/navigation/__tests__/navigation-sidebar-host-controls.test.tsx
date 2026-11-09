/**
 * What a host puts into the grouped sidebar besides its entries: a reveal
 * command (`revealSignal`) and rows for its own actions
 * (`NavigationSidebarActionRow`).
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NavigationSidebarConfig } from '../../../types/navigation';
import { NavigationSidebar } from '../navigation-sidebar';
import { NavigationSidebarActionRow } from '../navigation-sidebar-grouped';

const icon = <svg />;
const STORAGE_KEY = 'of.navigationSidebar.minimized';

/** The viewport: `tablet` = md without lg, `desktop` = lg. */
function viewport(kind: 'tablet' | 'desktop') {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    query =>
      ({
        matches: query === '(min-width: 800px)' || (kind === 'desktop' && query === '(min-width: 1280px)'),
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

/** The sidebar's own `minimized`, read back through a footer render function. */
const footer: NavigationSidebarConfig['footerSlot'] = ({ minimized }) => (minimized ? 'rail' : 'full');

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('NavigationSidebar revealSignal', () => {
  function Host({ initial, config }: { initial: number; config?: Partial<NavigationSidebarConfig> }) {
    const [signal, setSignal] = useState(initial);
    return (
      <>
        <button type="button" onClick={() => setSignal(s => s + 1)}>
          reveal
        </button>
        <NavigationSidebar
          config={{ variant: 'grouped', items: [], footerSlot: footer, revealSignal: signal, ...config }}
        />
      </>
    );
  }
  const reveal = () => fireEvent.click(screen.getByRole('button', { name: 'reveal' }));

  it('opens the tablet overlay even when the controlled value is already expanded', () => {
    viewport('tablet');
    render(<Host initial={0} config={{ collapsed: false, onCollapsedChange: vi.fn() }} />);
    // Entering tablet starts on the rail, whatever the desktop preference.
    expect(screen.getByText('rail')).toBeInTheDocument();
    reveal();
    expect(screen.getByText('full')).toBeInTheDocument();
  });

  it('takes the first value as no command', () => {
    viewport('tablet');
    render(<Host initial={7} />);
    expect(screen.getByText('rail')).toBeInTheDocument();
  });

  it('asks the host to expand a collapsed desktop sidebar', () => {
    viewport('desktop');
    const onCollapsedChange = vi.fn();
    render(<Host initial={0} config={{ collapsed: true, onCollapsedChange }} />);
    expect(onCollapsedChange).not.toHaveBeenCalled();
    reveal();
    expect(onCollapsedChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('expands the stored preference when uncontrolled', () => {
    viewport('desktop');
    window.localStorage.setItem(STORAGE_KEY, 'true');
    render(<Host initial={0} />);
    expect(screen.getByText('rail')).toBeInTheDocument();
    reveal();
    expect(screen.getByText('full')).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('false');
  });

  it('leaves an expanded desktop sidebar alone', () => {
    viewport('desktop');
    const onCollapsedChange = vi.fn();
    render(<Host initial={0} config={{ collapsed: false, onCollapsedChange }} />);
    reveal();
    expect(onCollapsedChange).not.toHaveBeenCalled();
  });
});

describe('NavigationSidebarActionRow', () => {
  it('links like a nav row: pill when active, the count in the pill and the name', () => {
    render(<NavigationSidebarActionRow icon={icon} label="Needs approval" href="/approvals" active count={3} />);
    const row = screen.getByRole('link', { name: 'Needs approval (3)' });
    expect(row).toHaveAttribute('href', '/approvals');
    expect(row).toHaveAttribute('aria-current', 'page');
    expect(row).toHaveClass('h-11', 'bg-ods-accent-secondary', 'text-ods-accent');
    expect(row).toHaveTextContent('3');
  });

  it('caps the count at 99+', () => {
    render(<NavigationSidebarActionRow icon={icon} label="Needs approval" href="/approvals" count={250} />);
    const row = screen.getByRole('link', { name: 'Needs approval (99+)' });
    expect(row).toHaveTextContent('99+');
    expect(row).not.toHaveAttribute('aria-current');
  });

  it('draws the count as a warning tag when asked (the three-column shell\'s "New Chat")', () => {
    render(<NavigationSidebarActionRow icon={icon} label="New Chat" size="sectioned" count={3} countTone="warning" />);
    const row = screen.getByRole('button', { name: 'New Chat (3)' });
    const tag = within(row).getByTestId('nav-row-count');
    expect(tag.tagName).toBe('SPAN');
    expect(tag).toHaveClass('h-7', 'bg-ods-warning-secondary', 'text-ods-warning');
    expect(tag).toHaveTextContent('3');
  });

  it('draws an outlined action button for "New chat"', () => {
    const onClick = vi.fn();
    render(<NavigationSidebarActionRow icon={icon} label="New chat" variant="outline" onClick={onClick} />);
    const row = screen.getByRole('button', { name: 'New chat' });
    expect(row).toHaveClass('border', 'border-ods-border', 'h-11');
    fireEvent.click(row);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is a disabled button when disabled, even with a destination', () => {
    render(<NavigationSidebarActionRow icon={icon} label="Needs approval" href="/approvals" disabled />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Needs approval' })).toBeDisabled();
  });

  it('carries its name as a tooltip in the rail', () => {
    render(<NavigationSidebarActionRow icon={icon} label="New chat" variant="outline" minimized />);
    expect(screen.getByRole('button', { name: 'New chat' })).toHaveAttribute('title', 'New chat');
  });
});

describe('NavigationSidebar overlay', () => {
  const sidebar = () => screen.getByRole('complementary', { name: 'Main navigation sidebar' });
  function Host({ overlay }: { overlay: boolean }) {
    const [collapsed, setCollapsed] = useState(false);
    return (
      <NavigationSidebar
        config={{
          variant: 'sectioned',
          items: [],
          toggle: 'icon',
          footerSlot: footer,
          collapsed,
          onCollapsedChange: setCollapsed,
          overlay,
        }}
      />
    );
  }

  it('takes the tablet form on desktop: the rail, opened over the content, the preference kept', () => {
    viewport('desktop');
    const { rerender } = render(<Host overlay={false} />);
    expect(screen.getByText('full')).toBeInTheDocument();
    expect(sidebar()).toHaveClass('lg:relative');

    rerender(<Host overlay />);
    // The rail, out of the flow (no desktop rule), whatever the expanded preference.
    expect(screen.getByText('rail')).toBeInTheDocument();
    expect(sidebar()).not.toHaveClass('lg:relative');
    expect(sidebar()).toHaveClass('md:absolute', 'md:w-14');

    // The toggle opens it over the content and Escape closes it; the host's value never moves.
    fireEvent.click(screen.getByRole('button', { name: /expand|show|open/i }));
    expect(screen.getByText('full')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByText('rail')).toBeInTheDocument();

    // Off again: the desktop preference (expanded) is back.
    rerender(<Host overlay={false} />);
    expect(screen.getByText('full')).toBeInTheDocument();
  });
});

describe('NavigationSidebar slot toggle', () => {
  const slot: NavigationSidebarConfig['footerSlot'] = ({ minimized, toggle }) => (
    <button type="button" onClick={toggle}>
      {minimized ? 'slot rail' : 'slot full'}
    </button>
  );

  it('flips the desktop preference, and only opens the overlay with `overlay`', () => {
    viewport('desktop');
    const onCollapsedChange = vi.fn();
    const config = (overlay: boolean): NavigationSidebarConfig => ({
      variant: 'grouped',
      items: [],
      toggle: 'none',
      footerSlot: slot,
      collapsed: false,
      onCollapsedChange,
      overlay,
    });
    const { rerender } = render(<NavigationSidebar config={config(false)} />);
    fireEvent.click(screen.getByRole('button', { name: 'slot full' }));
    expect(onCollapsedChange).toHaveBeenCalledWith(true);

    onCollapsedChange.mockClear();
    rerender(<NavigationSidebar config={config(true)} />);
    fireEvent.click(screen.getByRole('button', { name: 'slot rail' }));
    expect(screen.getByRole('button', { name: 'slot full' })).toBeInTheDocument();
    expect(onCollapsedChange).not.toHaveBeenCalled();
  });
});

describe("NavigationSidebar overlay 'drawer'", () => {
  const sidebar = () => screen.getByRole('complementary', { name: 'Main navigation sidebar', hidden: true });
  function Host({ path = '/a' }: { path?: string }) {
    const [reveal, setReveal] = useState(0);
    const [dismiss, setDismiss] = useState(0);
    return (
      <>
        <button type="button" onClick={() => setReveal(n => n + 1)}>
          open
        </button>
        <button type="button" onClick={() => setDismiss(n => n + 1)}>
          dismiss
        </button>
        <NavigationSidebar
          config={{
            variant: 'grouped',
            items: [],
            footerSlot: footer,
            collapsed: false,
            onCollapsedChange: vi.fn(),
            overlay: 'drawer',
            revealSignal: reveal,
            dismissSignal: dismiss,
            currentPath: path,
          }}
        />
      </>
    );
  }

  it('takes no room closed, opens on a reveal, closes on a dismiss and on a new page', () => {
    viewport('tablet');
    const { rerender } = render(<Host />);
    expect(sidebar()).toHaveClass('md:hidden');

    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    expect(sidebar()).not.toHaveClass('md:hidden');
    expect(screen.getByText('full')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'dismiss' }));
    expect(sidebar()).toHaveClass('md:hidden');

    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    rerender(<Host path="/b" />);
    expect(sidebar()).toHaveClass('md:hidden');
  });
});

/**
 * What a host puts into the grouped sidebar besides its entries: a reveal
 * command (`revealSignal`) and rows for its own actions
 * (`NavigationSidebarActionRow`).
 */

import { fireEvent, render, screen } from '@testing-library/react';
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

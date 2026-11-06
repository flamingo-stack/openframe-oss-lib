import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NavigationSidebarConfig, NavigationSidebarItem } from '../../../types/navigation';
import { NavigationSidebar } from '../navigation-sidebar';

const KEY = 'test.navigationSidebar.width';
const CHOSEN_KEY = `${KEY}:chosen`;
const WIDTH_VAR = '--of-navigation-sidebar-width';
const EXPANDED_VAR = '--of-navigation-sidebar-expanded-width';

const icon = <svg data-testid="icon" />;
const ITEMS: NavigationSidebarItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon, path: '/dashboard' },
  { id: 'devices', label: 'Devices', icon, path: '/devices' },
];
const RESIZABLE = { minWidth: 200, maxWidth: 480, storageKey: KEY };

// The sidebar measures its row (its parent) with a ResizeObserver; jsdom lays
// nothing out, so the test owns the width and the moment it is reported.
let rowWidth = 0;
let rowElement: HTMLElement | null = null;
let reportResize: () => void = () => {};

function setRowWidth(width: number) {
  rowWidth = width;
  act(() => reportResize());
}

function renderSidebar(config: Partial<NavigationSidebarConfig> = {}) {
  const row = document.createElement('div');
  Object.defineProperty(row, 'clientWidth', { configurable: true, get: () => rowWidth });
  document.body.appendChild(row);
  rowElement = row;
  return render(
    <NavigationSidebar
      config={{ variant: 'grouped', items: ITEMS, expandedWidth: 264, resizable: RESIZABLE, ...config }}
    />,
    { container: row },
  );
}

const rail = () => screen.getByRole('complementary', { name: 'Main navigation sidebar' });
const handle = () => screen.getByRole('separator', { name: 'Resize navigation sidebar' });
const width = () => Number(handle().getAttribute('aria-valuenow'));
const stored = () => window.localStorage.getItem(CHOSEN_KEY);
const toggle = () => screen.getByRole('button', { name: 'Hide Menu' });

beforeEach(() => {
  window.localStorage.clear();
  rowWidth = 1400;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      private readonly callback: () => void;
      constructor(callback: () => void) {
        this.callback = callback;
      }
      // Only the row's observer reports a resize: the labels' own (`useIsTruncated`) watch other nodes.
      observe(target: Element) {
        if (target === rowElement) reportResize = this.callback;
      }
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('NavigationSidebar — resizable', () => {
  it('has no handle unless the config asks for one', () => {
    renderSidebar({ resizable: undefined });
    expect(screen.queryByRole('separator')).toBeNull();
    expect(rail().style.getPropertyValue(WIDTH_VAR)).toBe('264px');
  });

  it('names the width and its bounds, starting from the config width', () => {
    renderSidebar();
    expect(handle()).toHaveAttribute('aria-valuenow', '264');
    expect(handle()).toHaveAttribute('aria-valuemin', '200');
    expect(handle()).toHaveAttribute('aria-valuemax', '480');
    expect(stored()).toBeNull();
  });

  it('resizes the flat variant from its 224px', () => {
    renderSidebar({ variant: 'flat', expandedWidth: undefined });
    expect(width()).toBe(224);
    expect(rail().style.getPropertyValue(WIDTH_VAR)).toBe('224px');
    expect(rail().style.getPropertyValue(EXPANDED_VAR)).toBe('224px');
  });

  it('never goes under the 141px the rows read as expanded', () => {
    renderSidebar({ resizable: { ...RESIZABLE, minWidth: 100 } });
    expect(handle()).toHaveAttribute('aria-valuemin', '141');
    fireEvent.keyDown(handle(), { key: 'Home' });
    expect(width()).toBe(141);
  });

  it('opens at the stored choice and publishes it to the rail', () => {
    window.localStorage.setItem(CHOSEN_KEY, JSON.stringify({ size: 400 }));
    renderSidebar();
    expect(width()).toBe(400);
    expect(rail().style.getPropertyValue(WIDTH_VAR)).toBe('400px');
    expect(rail().style.getPropertyValue(EXPANDED_VAR)).toBe('400px');
  });

  it('steps with the keyboard and stores each step', () => {
    renderSidebar();
    fireEvent.keyDown(handle(), { key: 'ArrowRight' });
    expect(width()).toBe(280);
    expect(stored()).toBe(JSON.stringify({ size: 280 }));
    fireEvent.keyDown(handle(), { key: 'ArrowLeft', shiftKey: true });
    expect(width()).toBe(240);
    fireEvent.keyDown(handle(), { key: 'Home' });
    expect(width()).toBe(200);
    fireEvent.keyDown(handle(), { key: 'End' });
    expect(width()).toBe(480);
    expect(stored()).toBe(JSON.stringify({ size: 480 }));
    expect(rail().style.getPropertyValue(WIDTH_VAR)).toBe('480px');
  });

  it('leaves the content its room on a narrow row, without touching the choice', () => {
    renderSidebar();
    fireEvent.keyDown(handle(), { key: 'End' });
    expect(stored()).toBe(JSON.stringify({ size: 480 }));
    // 1000px of row minus the 720px the content keeps.
    setRowWidth(1000);
    expect(width()).toBe(280);
    expect(handle()).toHaveAttribute('aria-valuemax', '280');
    expect(stored()).toBe(JSON.stringify({ size: 480 }));
    setRowWidth(1400);
    expect(width()).toBe(480);
  });

  it('a drag moves the rail on every move and stores once, on release', () => {
    renderSidebar();
    const grip = handle();
    grip.setPointerCapture = vi.fn();
    grip.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(grip, { button: 0, clientX: 264, pointerId: 1 });
    fireEvent.pointerMove(grip, { clientX: 300, pointerId: 1 });
    expect(rail()).toHaveAttribute('data-resizing');
    expect(rail().style.getPropertyValue(WIDTH_VAR)).toBe('300px');
    expect(stored()).toBeNull();
    fireEvent.pointerMove(grip, { clientX: 600, pointerId: 1 });
    expect(rail().style.getPropertyValue(WIDTH_VAR)).toBe('480px');
    fireEvent.pointerUp(grip, { clientX: 600, pointerId: 1 });
    expect(rail()).not.toHaveAttribute('data-resizing');
    expect(width()).toBe(480);
    expect(stored()).toBe(JSON.stringify({ size: 480 }));
  });

  it('a double click goes back to the config width and forgets the choice', () => {
    renderSidebar();
    fireEvent.keyDown(handle(), { key: 'End' });
    expect(stored()).not.toBeNull();
    fireEvent.doubleClick(handle());
    expect(width()).toBe(264);
    expect(stored()).toBeNull();
    expect(rail().style.getPropertyValue(WIDTH_VAR)).toBe('264px');
  });

  it('has no handle in the 56px rail', () => {
    renderSidebar({ collapsed: true });
    expect(screen.queryByRole('separator')).toBeNull();
    expect(rail().style.getPropertyValue(WIDTH_VAR)).toBe('56px');
  });

  it('keeps the choice across a collapse and back', () => {
    renderSidebar();
    fireEvent.keyDown(handle(), { key: 'End' });
    fireEvent.click(toggle());
    expect(screen.queryByRole('separator')).toBeNull();
    expect(rail().style.getPropertyValue(WIDTH_VAR)).toBe('56px');
    fireEvent.click(toggle());
    expect(width()).toBe(480);
    expect(rail().style.getPropertyValue(WIDTH_VAR)).toBe('480px');
  });

  it('hydrates the server HTML without a mismatch, then shows the stored width', () => {
    const row = document.createElement('div');
    Object.defineProperty(row, 'clientWidth', { configurable: true, get: () => rowWidth });
    document.body.appendChild(row);
    const element = (
      <NavigationSidebar config={{ variant: 'grouped', items: ITEMS, expandedWidth: 264, resizable: RESIZABLE }} />
    );
    // The server has no storage: its HTML carries the config width. The
    // choice is there by the time the client renders, and must not reach the
    // markup before React has matched it against that HTML.
    row.innerHTML = renderToString(element);
    expect(within(row).getByRole('separator', { name: 'Resize navigation sidebar' })).toHaveAttribute(
      'aria-valuenow',
      '264',
    );
    window.localStorage.setItem(CHOSEN_KEY, JSON.stringify({ size: 251 }));
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    let root: Root | undefined;
    act(() => {
      root = hydrateRoot(row, element);
    });
    expect(errors.mock.calls.map(call => String(call[0])).filter(message => /hydrat/i.test(message))).toEqual([]);
    expect(handle()).toHaveAttribute('aria-valuenow', '251');
    expect(rail().style.getPropertyValue(WIDTH_VAR)).toBe('251px');
    expect(rail().style.getPropertyValue(EXPANDED_VAR)).toBe('251px');
    act(() => root?.unmount());
    errors.mockRestore();
  });
});

import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Drawer, DrawerContent, DrawerTitle } from '../drawer';

const KEY = 'test-drawer-width';
// The chosen size has a key of its own; see `useResizablePanelSize`.
const CHOSEN_KEY = `${KEY}:chosen`;

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
}

const halfTheViewport = (viewportWidth: number) => Math.round(viewportWidth * 0.5);

function DrawerUnder({ storageKey }: { storageKey: string }) {
  return (
    <Drawer open>
      <DrawerContent
        resizable
        minSize={480}
        maxSize={1600}
        defaultSize={halfTheViewport}
        storageKey={storageKey}
        aria-describedby={undefined}
      >
        <DrawerTitle>Panel</DrawerTitle>
      </DrawerContent>
    </Drawer>
  );
}

const renderDrawer = () => render(<DrawerUnder storageKey={KEY} />);

const handle = () => screen.getByRole('separator');
// The handle reports the size the panel is rendered at.
const panelWidth = () => Number(handle().getAttribute('aria-valuenow'));

describe('resizable Drawer size', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setViewportWidth(1728);
  });

  it('stores nothing until the user resizes, and follows a viewport-relative default', () => {
    const view = renderDrawer();
    expect(panelWidth()).toBe(864);
    expect(window.localStorage.getItem(CHOSEN_KEY)).toBeNull();

    // The default tracks the window while the panel stays mounted.
    setViewportWidth(2560);
    expect(panelWidth()).toBe(1280);
    expect(window.localStorage.getItem(CHOSEN_KEY)).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
    view.unmount();
  });

  it('gives the chosen size back after the viewport was narrow', () => {
    renderDrawer();
    // End asks for the maximum: 1600, the most a 1728px viewport allows minus the 80px gap.
    fireEvent.keyDown(handle(), { key: 'End' });
    expect(panelWidth()).toBe(1600);
    const stored = window.localStorage.getItem(CHOSEN_KEY);
    expect(stored).toBe(JSON.stringify({ size: 1600 }));

    // A phone-sized emulation: the panel shrinks to its minimum for as long as it lasts.
    setViewportWidth(375);
    expect(panelWidth()).toBe(480);
    expect(window.localStorage.getItem(CHOSEN_KEY)).toBe(stored);

    setViewportWidth(1728);
    expect(panelWidth()).toBe(1600);
  });

  it('reads the chosen size on the next mount, at any viewport', () => {
    window.localStorage.setItem(CHOSEN_KEY, JSON.stringify({ size: 1100 }));
    setViewportWidth(375);
    const view = renderDrawer();
    expect(panelWidth()).toBe(480);
    view.unmount();

    setViewportWidth(1728);
    renderDrawer();
    expect(panelWidth()).toBe(1100);
    expect(window.localStorage.getItem(CHOSEN_KEY)).toBe(JSON.stringify({ size: 1100 }));
  });

  it('ignores a bare number left by the previous implementation', () => {
    window.localStorage.setItem(KEY, '480');
    renderDrawer();
    expect(panelWidth()).toBe(864);
  });

  it('keeps the choice when a page on the previous implementation rewrites its own key', () => {
    const view = renderDrawer();
    fireEvent.keyDown(handle(), { key: 'End' });
    window.localStorage.setItem(KEY, '864');
    view.unmount();
    renderDrawer();
    expect(panelWidth()).toBe(1600);
  });

  it('stores a drag once, on release', () => {
    renderDrawer();
    const grip = handle();
    grip.setPointerCapture = vi.fn();
    grip.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(grip, { button: 0, clientX: 864, pointerId: 1 });
    fireEvent.pointerMove(grip, { clientX: 700, pointerId: 1 });
    fireEvent.pointerMove(grip, { clientX: 564, pointerId: 1 });
    expect(window.localStorage.getItem(CHOSEN_KEY)).toBeNull();
    fireEvent.pointerUp(grip, { clientX: 564, pointerId: 1 });
    expect(panelWidth()).toBe(1164);
    expect(window.localStorage.getItem(CHOSEN_KEY)).toBe(JSON.stringify({ size: 1164 }));
  });

  it('reads the other key when the storage key changes', () => {
    window.localStorage.setItem(`other-drawer:chosen`, JSON.stringify({ size: 700 }));
    const view = renderDrawer();
    fireEvent.keyDown(handle(), { key: 'End' });
    expect(panelWidth()).toBe(1600);
    view.rerender(<DrawerUnder storageKey="other-drawer" />);
    expect(panelWidth()).toBe(700);
  });
});

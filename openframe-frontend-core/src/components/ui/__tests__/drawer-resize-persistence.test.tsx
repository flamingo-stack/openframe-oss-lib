import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Drawer, DrawerContent, DrawerTitle } from '../drawer';

const KEY = 'test-drawer-width';

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
}

function renderDrawer(defaultSize: () => number = () => Math.round(window.innerWidth * 0.5)) {
  function Harness() {
    return (
      <Drawer open>
        <DrawerContent
          resizable
          minSize={480}
          maxSize={1600}
          defaultSize={defaultSize()}
          storageKey={KEY}
          aria-describedby={undefined}
        >
          <DrawerTitle>Panel</DrawerTitle>
        </DrawerContent>
      </Drawer>
    );
  }
  return render(<Harness />);
}

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
    expect(window.localStorage.getItem(KEY)).toBeNull();

    view.unmount();
    setViewportWidth(2560);
    renderDrawer();
    expect(panelWidth()).toBe(1280);
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('gives the chosen size back after the viewport was narrow', () => {
    renderDrawer();
    // End asks for the maximum: 1600, the most a 1728px viewport allows minus the 80px gap.
    fireEvent.keyDown(handle(), { key: 'End' });
    expect(panelWidth()).toBe(1600);
    const stored = window.localStorage.getItem(KEY);
    expect(stored).toBe(JSON.stringify({ size: 1600 }));

    // A phone-sized emulation: the panel shrinks to its minimum for as long as it lasts.
    setViewportWidth(375);
    expect(panelWidth()).toBe(480);
    expect(window.localStorage.getItem(KEY)).toBe(stored);

    setViewportWidth(1728);
    expect(panelWidth()).toBe(1600);
  });

  it('reads the chosen size on the next mount, at any viewport', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ size: 1100 }));
    setViewportWidth(375);
    const view = renderDrawer();
    expect(panelWidth()).toBe(480);
    view.unmount();

    setViewportWidth(1728);
    renderDrawer();
    expect(panelWidth()).toBe(1100);
    expect(window.localStorage.getItem(KEY)).toBe(JSON.stringify({ size: 1100 }));
  });

  it('ignores a bare number left by the previous implementation', () => {
    window.localStorage.setItem(KEY, '480');
    renderDrawer();
    expect(panelWidth()).toBe(864);
  });
});

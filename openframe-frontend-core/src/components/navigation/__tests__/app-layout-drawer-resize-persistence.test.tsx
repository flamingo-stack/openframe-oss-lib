import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppLayoutDrawer, AppLayoutDrawerContent } from '../app-layout-drawer';

const KEY = 'test-layout-drawer-width';
const CHOSEN_KEY = `${KEY}:chosen`;

// The drawer measures its container with a ResizeObserver; jsdom lays nothing
// out, so the test owns both the width and the moment it is reported.
let containerWidth = 0;
let reportResize: () => void = () => {};

function setContainerWidth(width: number) {
  containerWidth = width;
  act(() => reportResize());
}

function renderDrawer() {
  const container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { configurable: true, get: () => containerWidth });
  document.body.appendChild(container);
  return render(
    <AppLayoutDrawer open>
      <AppLayoutDrawerContent
        resizable
        minSize={480}
        defaultSize={600}
        storageKey={KEY}
        container={container}
        aria-label="Panel"
        aria-describedby={undefined}
      >
        content
      </AppLayoutDrawerContent>
    </AppLayoutDrawer>,
  );
}

const handle = () => screen.getByRole('separator');
const panelWidth = () => Number(handle().getAttribute('aria-valuenow'));

describe('resizable AppLayoutDrawer size', () => {
  beforeEach(() => {
    window.localStorage.clear();
    containerWidth = 1400;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          reportResize = callback;
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('stores nothing until the user resizes', () => {
    renderDrawer();
    expect(panelWidth()).toBe(600);
    setContainerWidth(500);
    expect(panelWidth()).toBe(480);
    expect(window.localStorage.getItem(CHOSEN_KEY)).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('gives the chosen size back after the container was narrow', () => {
    renderDrawer();
    // End asks for the maximum: the container minus the 40px the panel never takes.
    fireEvent.keyDown(handle(), { key: 'End' });
    expect(panelWidth()).toBe(1360);
    const stored = window.localStorage.getItem(CHOSEN_KEY);
    expect(stored).toBe(JSON.stringify({ size: 1360 }));

    setContainerWidth(500);
    expect(panelWidth()).toBe(480);
    expect(window.localStorage.getItem(CHOSEN_KEY)).toBe(stored);

    setContainerWidth(1400);
    expect(panelWidth()).toBe(1360);
  });

  it('stores a drag once, on release', () => {
    renderDrawer();
    const grip = handle();
    grip.setPointerCapture = vi.fn();
    grip.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(grip, { button: 0, clientX: 800, pointerId: 1 });
    fireEvent.pointerMove(grip, { clientX: 700, pointerId: 1 });
    fireEvent.pointerMove(grip, { clientX: 500, pointerId: 1 });
    expect(window.localStorage.getItem(CHOSEN_KEY)).toBeNull();
    fireEvent.pointerUp(grip, { clientX: 500, pointerId: 1 });
    expect(window.localStorage.getItem(CHOSEN_KEY)).toBe(JSON.stringify({ size: 900 }));
  });
});

/**
 * Pins where the "Log Details" drawer puts a log: the title row stays in the
 * header, the log text and the info fields share the body's scroll region, and
 * the device card sits under that region, pinned to the bottom. A long log used
 * to render in the header, which is not a scroll region, so the panel clipped
 * it and the body shrank to nothing. Each assertion was verified to fail with
 * its guard removed.
 */

import type { ComponentProps } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LogDrawer } from './log-drawer';

// The info fields render through TruncateText, which measures with a
// ResizeObserver; jsdom has none, and nothing here depends on the measurement.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const LONG_LOG = `Log ID: evt-1\nStatus: INFO\nDetails: ${'{"output":"a line of script output"}\n'.repeat(400)}`;

let container: HTMLDivElement;
let root: Root;

function mount(props: Partial<ComponentProps<typeof LogDrawer>> = {}) {
  // Synchronous, effects included: the drawer portals on mount.
  flushSync(() => {
    root.render(
      <LogDrawer
        isOpen
        onClose={() => {}}
        description={LONG_LOG}
        statusTag={{ label: 'INFO' }}
        timestamp="Oct 6, 2026"
        infoFields={[{ label: 'Log ID', value: 'evt-1' }]}
        {...props}
      />,
    );
  });
}

/** The leaf element whose text is exactly `text`. The drawer portals to `document.body`. */
function leafByText(text: string): HTMLElement {
  const match = [...document.body.querySelectorAll<HTMLElement>('*')].find(
    element => element.childElementCount === 0 && element.textContent === text,
  );
  if (!match) throw new Error(`no element with text ${JSON.stringify(text.slice(0, 40))}`);
  return match;
}

/** The nearest scroll region around `element`, the way the wheel finds it. */
const scrollRegionOf = (element: HTMLElement) => element.closest<HTMLElement>('.overflow-y-auto');

describe('LogDrawer', () => {
  beforeEach(() => {
    window.matchMedia = (() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    })) as unknown as typeof window.matchMedia;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    flushSync(() => root.unmount());
    container.remove();
  });

  it('renders the log text inside the scroll region, next to the info fields and away from the title', () => {
    mount();

    const log = leafByText(LONG_LOG);
    const region = scrollRegionOf(log);
    expect(region).not.toBeNull();
    expect(region?.contains(leafByText('Log ID'))).toBe(true);

    const title = leafByText('Log Details');
    expect(region?.contains(title)).toBe(false);
    expect(scrollRegionOf(title)).toBeNull();
  });

  it('keeps the log text as the dialog description', () => {
    mount();

    const dialog = document.body.querySelector('[role="dialog"]');
    const describedBy = dialog?.getAttribute('aria-describedby') ?? '';
    expect(describedBy).not.toBe('');
    expect(document.getElementById(describedBy)).toBe(leafByText(LONG_LOG));
  });

  it('pins the device card under the scroll region instead of scrolling it with the log', () => {
    mount({ deviceCard: <div data-testid="device-card">SAM-T14</div> });

    const region = scrollRegionOf(leafByText(LONG_LOG));
    const body = region?.parentElement;
    const pinned = body?.lastElementChild;
    expect(pinned).not.toBe(region);
    expect(pinned?.classList.contains('mt-auto')).toBe(true);
    expect(pinned?.querySelector('[data-testid="device-card"]')).not.toBeNull();
    expect(region?.contains(pinned ?? null)).toBe(false);
  });

  it('renders no pinned slot without a device card', () => {
    mount();

    const region = scrollRegionOf(leafByText(LONG_LOG));
    expect(region?.parentElement?.lastElementChild).toBe(region);
  });
});

import { render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MarqueeWall, useMarqueeSync } from '../marquee-wall';

/**
 * Integration guard for the pair's `useSyncExternalStore` wiring. The election
 * is read during render, which is where the classic footgun lives: a snapshot
 * that is not referentially stable makes React bail with "The result of
 * getSnapshot should be cached to avoid an infinite loop", and a `subscribe`
 * whose identity changes every render churns the subscription on every commit.
 * Both surface as console errors, so the assertion is that mounting, pairing
 * and unmounting a pair stays silent.
 */
beforeAll(() => {
  // jsdom ships none of these; the wall observes itself and its viewport on
  // mount, and asks about reduced motion.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = '';
    thresholds = [];
  };
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function Pair({ showFirst }: { showFirst: boolean }) {
  const sync = useMarqueeSync();
  return (
    <>
      {showFirst && (
        <MarqueeWall sync={sync}>
          <span>first</span>
        </MarqueeWall>
      )}
      <MarqueeWall sync={sync}>
        <span>second</span>
      </MarqueeWall>
    </>
  );
}

describe('<MarqueeWall> sync pairing', () => {
  it('mounts, re-elects and unmounts a pair without a render-loop or subscription warning', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const view = render(<Pair showFirst />);
    expect(screen.getByText('first')).toBeTruthy();

    // Drops the elected driver while its peer survives — the promotion path.
    view.rerender(<Pair showFirst={false} />);
    expect(screen.queryByText('first')).toBeNull();
    expect(screen.getByText('second')).toBeTruthy();

    view.unmount();

    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});

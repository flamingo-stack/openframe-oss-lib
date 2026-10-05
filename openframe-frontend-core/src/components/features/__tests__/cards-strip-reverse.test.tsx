import { act, render } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CardsStrip } from '../cards-strip';

/**
 * `reverse` flips the DIRECTION the marquee travels and nothing else. jsdom has
 * no layout, so the strip is given one: a 500px viewport over a track whose
 * single copy is 2000px wide, which makes it overflow and mount the marquee.
 * Frames are driven by fake timers; the assertion reads the positions the
 * engine WRITES to `scrollLeft` (recorded by the setter below), so the test
 * needs no handle on the scroller element.
 */
const VIEWPORT = 500;
const COPY = 2000;
const GAP = 16;

/** Every value written to an element's `scrollLeft`, in order. */
let writes: number[] = [];
const stored = new WeakMap<object, number>();

beforeAll(() => {
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
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => VIEWPORT });
  Object.defineProperty(HTMLElement.prototype, 'scrollLeft', {
    configurable: true,
    get(this: HTMLElement) {
      return stored.get(this) ?? 0;
    },
    set(this: HTMLElement, value: number) {
      stored.set(this, value);
      writes.push(value);
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get(this: HTMLElement) {
      // The track reports one copy, or two copies joined by one gap once cloned.
      return this.dataset.copies === '2' ? COPY * 2 - GAP : COPY;
    },
  });
});

beforeEach(() => {
  writes = [];
  vi.useFakeTimers({
    toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout', 'clearTimeout'],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

/** Mount a strip, run its marquee for `ms`, and return the positions it wrote. */
function travel(reverse: boolean, ms: number): number[] {
  render(
    <CardsStrip showTitle={false} reverse={reverse} pauseOnHover={false}>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i}>card {i}</div>
      ))}
    </CardsStrip>,
  );
  for (let elapsed = 0; elapsed < ms; elapsed += 16) {
    act(() => {
      vi.advanceTimersByTime(16);
    });
  }
  return writes;
}

/** +1 when the positions only grow, -1 when they only shrink, 0 otherwise (seam wraps ignored). */
function direction(positions: number[]): number {
  const steps = positions
    .slice(1)
    .map((p, i) => p - positions[i])
    .filter(d => d !== 0 && Math.abs(d) < COPY / 2);
  if (steps.length === 0) return 0;
  if (steps.every(d => d > 0)) return 1;
  if (steps.every(d => d < 0)) return -1;
  return 0;
}

describe('<CardsStrip reverse>', () => {
  it('travels forward by default: scrollLeft grows', () => {
    const positions = travel(false, 1500);
    expect(positions.length).toBeGreaterThan(10);
    expect(direction(positions)).toBe(1);
  });

  it('travels the other way when reversed: scrollLeft shrinks', () => {
    const positions = travel(true, 1500);
    expect(positions.length).toBeGreaterThan(10);
    expect(direction(positions)).toBe(-1);
  });

  it('keeps a reversed strip inside the range a forward strip uses', () => {
    for (const p of travel(true, 3000)) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(COPY * 2);
    }
  });
});

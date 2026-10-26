import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CardsStrip } from '../cards-strip';

/**
 * Without the marquee (`autoScroll={false}`, or reduced motion) the strip's arrows scroll natively. They loop like the
 * marquee does: next at the track's end goes back to its start, previous at its start goes to its end. jsdom has no
 * layout, so the strip is given one: a 500px viewport over a 2000px track.
 */
const VIEWPORT = 500;
const TRACK = 2000;
const MAX = TRACK - VIEWPORT;

/** The scroller's position (every element reads it: jsdom has no layout to tell them apart). */
let position = 0;
let calls: Array<{ kind: 'to' | 'by'; left: number }> = [];

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
    scrollMargin = '';
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
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => TRACK });
  Object.defineProperty(HTMLElement.prototype, 'scrollLeft', {
    configurable: true,
    get() {
      return position;
    },
    set(value: number) {
      position = value;
    },
  });
  HTMLElement.prototype.scrollTo = function scrollTo(this: HTMLElement, options?: ScrollToOptions | number) {
    calls.push({ kind: 'to', left: typeof options === 'object' ? (options.left ?? 0) : 0 });
  };
  HTMLElement.prototype.scrollBy = function scrollBy(this: HTMLElement, options?: ScrollToOptions | number) {
    calls.push({ kind: 'by', left: typeof options === 'object' ? (options.left ?? 0) : 0 });
  };
});

beforeEach(() => {
  calls = [];
  position = 0;
});

afterEach(() => {
  document.body.innerHTML = '';
});

function renderStrip() {
  render(
    <CardsStrip showTitle={false} autoScroll={false}>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i}>card {i}</div>
      ))}
    </CardsStrip>,
  );
  return { prev: screen.getByLabelText('Previous items'), next: screen.getByLabelText('Next items') };
}

describe('CardsStrip arrows without the marquee', () => {
  it('previous at the start goes to the end of the track', () => {
    const { prev } = renderStrip();
    position = 0;
    fireEvent.click(prev);
    expect(calls).toEqual([{ kind: 'to', left: MAX }]);
  });

  it('next at the end goes back to the start of the track', () => {
    const { next } = renderStrip();
    position = MAX;
    fireEvent.click(next);
    expect(calls).toEqual([{ kind: 'to', left: 0 }]);
  });

  it('steps one card in the middle of the track', () => {
    const { next, prev } = renderStrip();
    position = 700;
    fireEvent.click(next);
    fireEvent.click(prev);
    expect(calls.map(c => c.kind)).toEqual(['by', 'by']);
    expect(Math.sign(calls[0].left)).toBe(1);
    expect(Math.sign(calls[1].left)).toBe(-1);
  });
});

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScrollSpy } from '../use-scroll-spy';

/**
 * `useScrollSpy` highlights the section whose DOCUMENT-absolute top has passed
 * the offset line (not `offsetTop`, which is relative to a positioned
 * ancestor), and the last section once the page is scrolled to the bottom.
 */

const TOPS: Record<string, number> = { a: 300, b: 900, c: 1500 };

const created = new Map<string, HTMLElement>();

function placeSections(scrollY: number) {
  for (const [id, top] of Object.entries(TOPS)) {
    let el = created.get(id);
    if (!el) {
      el = document.createElement('section');
      el.id = id;
      document.body.append(el);
      created.set(id, el);
    }
    // Viewport-relative top = document top - scrollY; offsetTop deliberately wrong (a positioned parent).
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ top: top - scrollY } as DOMRect);
    Object.defineProperty(el, 'offsetTop', { configurable: true, value: 10 });
  }
}

function scrollTo(scrollY: number, scrollHeight = 5000) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: scrollY });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: scrollHeight });
  placeSections(scrollY);
  act(() => {
    window.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(150);
  });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const el of created.values()) el.remove();
  created.clear();
});

describe('useScrollSpy', () => {
  const sections = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('follows the document-absolute section tops, not offsetTop', () => {
    placeSections(0);
    const { result } = renderHook(() => useScrollSpy(sections));
    scrollTo(850); // 850 + 100 ≥ 900 → b
    expect(result.current.activeSection).toBe('b');
    scrollTo(250); // 350 ≥ 300 → a
    expect(result.current.activeSection).toBe('a');
  });

  it('highlights the last section at the bottom of the page even if its top never reaches the line', () => {
    placeSections(0);
    const { result } = renderHook(() => useScrollSpy(sections));
    scrollTo(1100, 1900); // 1100 + 800 ≥ 1900 → bottom → c (its top, 1500, never passes 1200)
    expect(result.current.activeSection).toBe('c');
  });

  it('a short (non-scrollable) page does NOT jump to the last section — the section tops decide', () => {
    placeSections(0);
    const { result } = renderHook(() => useScrollSpy(sections));
    scrollTo(0, 800); // scrollHeight == innerHeight: "at bottom" at scrollY 0, but nothing scrolls
    expect(result.current.activeSection).toBe('a');
  });
});

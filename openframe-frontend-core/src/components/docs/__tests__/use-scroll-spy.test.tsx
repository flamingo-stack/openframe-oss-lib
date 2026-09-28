import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scrollElementIntoView } from '../../../utils/scroll-into-view';
import { useScrollSpy } from '../use-scroll-spy';

// The click's scroll is the shared tween; only its arguments matter here.
// `getScrollableAncestor` stays real — it is what the spy resolves its scroller with.
vi.mock('../../../utils/scroll-into-view', async importOriginal => ({
  ...(await importOriginal()),
  scrollElementIntoView: vi.fn(),
}));

/**
 * `useScrollSpy` highlights the section whose top — measured in the SCROLLER's
 * own coordinates (not `offsetTop`, which is relative to a positioned
 * ancestor) — has passed the offset line, and the last section once the
 * scroller is at the bottom. The scroller is the window on a plain page, and
 * the nearest scroll container when an app shell scrolls a `<main>` instead.
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

describe('useScrollSpy — syncHash', () => {
  const sections = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const urls = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls.map(call => call[2]);

  it('as the user scrolls, the URL hash follows the section being read — replaceState only, never a hashchange', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    const hashchange = vi.fn();
    window.addEventListener('hashchange', hashchange);
    placeSections(0);
    renderHook(() => useScrollSpy(sections, { syncHash: true }));
    scrollTo(850);
    scrollTo(1450);
    expect(urls(replaceState)).toEqual(['/#b', '/#c']);
    expect(hashchange).not.toHaveBeenCalled();
    window.removeEventListener('hashchange', hashchange);
  });

  it('above the first section the hash is cleared; mounting alone writes nothing', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    placeSections(0);
    renderHook(() => useScrollSpy(sections, { syncHash: true }));
    expect(replaceState).not.toHaveBeenCalled();
    scrollTo(50); // 150 < 300: above section a
    expect(urls(replaceState)).toEqual(['/']);
  });

  it('off by default: scrolling never touches the URL', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    placeSections(0);
    renderHook(() => useScrollSpy(sections));
    scrollTo(850);
    expect(replaceState).not.toHaveBeenCalled();
  });
});

describe('useScrollSpy — a rail click', () => {
  const sections = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('highlights the clicked section at once and scrolls it under the header offset', () => {
    placeSections(0);
    const { result } = renderHook(() => useScrollSpy(sections, { headerOffset: 96 }));
    act(() => result.current.handleSectionClick('c'));
    expect(result.current.activeSection).toBe('c');
    expect(scrollElementIntoView).toHaveBeenCalledWith(created.get('c'), { headerOffset: 96 });
  });

  it('with syncHash, writes #section right away — replaceState, no history entry, no hashchange', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    const pushState = vi.spyOn(window.history, 'pushState');
    const hashchange = vi.fn();
    window.addEventListener('hashchange', hashchange);
    placeSections(0);
    const { result } = renderHook(() => useScrollSpy(sections, { syncHash: true }));
    act(() => result.current.handleSectionClick('b'));
    expect(replaceState).toHaveBeenCalledWith(null, '', '/#b');
    expect(pushState).not.toHaveBeenCalled();
    expect(hashchange).not.toHaveBeenCalled();
    window.removeEventListener('hashchange', hashchange);
  });

  it('without syncHash, a click leaves the URL alone', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    placeSections(0);
    const { result } = renderHook(() => useScrollSpy(sections));
    act(() => result.current.handleSectionClick('b'));
    expect(replaceState).not.toHaveBeenCalled();
  });
});

describe('useScrollSpy — headerOffset', () => {
  const sections = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('is the detection line too, so the highlight agrees with where a click lands', () => {
    placeSections(0);
    const { result } = renderHook(() => useScrollSpy(sections, { headerOffset: 50 }));
    scrollTo(860); // 860 + 50 ≥ 900 → b
    expect(result.current.activeSection).toBe('b');
    scrollTo(840); // 890 < 900 → still a (the default 100 would already say b)
    expect(result.current.activeSection).toBe('a');
  });
});

/**
 * An app shell that scrolls a fixed-height `<main overflow-y-auto>` instead of
 * the window (OpenFrame's `AppLayout`): the window never scrolls and never
 * emits `scroll`, so the spy must listen to the container and measure section
 * tops relative to it — the shell's header sits ABOVE the container, so a
 * viewport-relative top is off by that much.
 */
describe('useScrollSpy — inside a scroll container', () => {
  const sections = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  /** The shell header above `<main>`: where the container starts in the viewport. */
  const CONTAINER_TOP = 64;
  let container: HTMLElement;
  let containerScrollTop = 0;

  function placeInContainer(scrollTop: number) {
    for (const [id, top] of Object.entries(TOPS)) {
      const el = created.get(id);
      if (!el) throw new Error(`section ${id} not mounted`);
      // Viewport-relative top = container's viewport top + (offset inside the container − its scrollTop).
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ top: CONTAINER_TOP + top - scrollTop } as DOMRect);
    }
  }

  function mountContainer(scrollHeight = 5000) {
    container = document.createElement('main');
    container.style.overflowY = 'auto';
    document.body.append(container);
    containerScrollTop = 0;
    // jsdom lays nothing out: give the container the geometry of a scrolling <main>.
    Object.defineProperty(container, 'scrollHeight', { configurable: true, value: scrollHeight });
    Object.defineProperty(container, 'clientHeight', { configurable: true, value: 700 });
    Object.defineProperty(container, 'scrollTop', {
      configurable: true,
      get: () => containerScrollTop,
      set: (value: number) => {
        containerScrollTop = value;
      },
    });
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({ top: CONTAINER_TOP } as DOMRect);
    for (const id of Object.keys(TOPS)) {
      const el = document.createElement('section');
      el.id = id;
      container.append(el);
      created.set(id, el);
    }
    placeInContainer(0);
    // The window stays parked: a window-bound spy would read these and see nothing.
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 800 });
  }

  function scrollContainerTo(scrollTop: number) {
    container.scrollTop = scrollTop;
    placeInContainer(scrollTop);
    act(() => {
      container.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(150);
    });
  }

  afterEach(() => container.remove());

  it('follows the container scroll, measuring section tops in the container coordinates', () => {
    mountContainer();
    const { result } = renderHook(() => useScrollSpy(sections));
    expect(result.current.activeSection).toBe('a');
    scrollContainerTo(850); // 850 + 100 ≥ 900 → b (viewport top 114 alone would have said a)
    expect(result.current.activeSection).toBe('b');
    scrollContainerTo(250); // 350 ≥ 300 → a
    expect(result.current.activeSection).toBe('a');
  });

  it('ignores the window: a window scroll event changes nothing', () => {
    mountContainer();
    const { result } = renderHook(() => useScrollSpy(sections));
    scrollContainerTo(850);
    expect(result.current.activeSection).toBe('b');
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 4000 });
    act(() => {
      window.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(150);
    });
    expect(result.current.activeSection).toBe('b');
  });

  it('highlights the last section at the bottom of the container', () => {
    mountContainer(2200);
    const { result } = renderHook(() => useScrollSpy(sections));
    scrollContainerTo(1500); // 700 + 1500 ≥ 2200 → bottom → c (its top, 1500, never passes 1600)
    expect(result.current.activeSection).toBe('c');
  });

  it('syncHash follows the container scroll', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    mountContainer();
    renderHook(() => useScrollSpy(sections, { syncHash: true }));
    scrollContainerTo(850);
    scrollContainerTo(50); // 150 < 300: above section a → cleared
    expect(replaceState.mock.calls.map(call => call[2])).toEqual(['/#b', '/']);
  });
});

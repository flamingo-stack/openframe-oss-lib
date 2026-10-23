import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SnapCarousel } from '../snap-carousel';

type IOCallback = (entries: Array<{ isIntersecting: boolean; intersectionRatio: number; target: Element }>) => void;

const ITEMS = ['one', 'two', 'three'];
const SLIDE_WIDTH = 300;
const STEP = SLIDE_WIDTH + 12;

describe('SnapCarousel', () => {
  let callbacks: IOCallback[];
  let scrolledTo: number[];

  const setInView = (inView: boolean) =>
    act(() => {
      for (const cb of callbacks) {
        cb([{ isIntersecting: inView, intersectionRatio: inView ? 1 : 0, target: document.body }]);
      }
    });

  beforeEach(() => {
    vi.useFakeTimers();
    callbacks = [];
    scrolledTo = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IOCallback) {
          callbacks.push(cb);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => SLIDE_WIDTH });
    HTMLElement.prototype.scrollTo = function scrollTo(this: HTMLElement, options?: ScrollToOptions | number) {
      const left = typeof options === 'object' ? (options.left ?? 0) : 0;
      scrolledTo.push(left);
      Object.defineProperty(this, 'scrollLeft', { configurable: true, value: left });
      fireEvent.scroll(this);
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const renderCarousel = () =>
    render(<SnapCarousel items={ITEMS} label="Example requests" renderItem={item => <p>{item}</p>} />);

  it('says where it is and disables the arrow at each end', () => {
    renderCarousel();
    expect(screen.getByText('1 / 3')).toBeTruthy();
    expect(screen.getByLabelText<HTMLButtonElement>('Previous').disabled).toBe(true);
    expect(screen.getByLabelText<HTMLButtonElement>('Next').disabled).toBe(false);
    expect(screen.getByRole('group', { name: 'Example requests' }).getAttribute('aria-roledescription')).toBe(
      'carousel',
    );
  });

  it("draws its arrows as the carousel's step buttons: round, no fill, never the strip's outline icon button", () => {
    renderCarousel();
    for (const name of ['Previous', 'Next']) {
      const arrow = screen.getByLabelText(name);
      expect(arrow.classList.contains('rounded-full')).toBe(true);
      expect(arrow.classList.contains('bg-transparent')).toBe(true);
      expect(arrow.classList.contains('bg-ods-card')).toBe(false);
      expect(arrow.classList.contains('rounded-md')).toBe(false);
    }
  });

  it('reaches its last slide when several are in view, wraps to the first, and steps back from the end', () => {
    // Five slides, a track that shows about two: it can scroll no further than 2.7 steps, as a browser clamps it.
    const items = ['a', 'b', 'c', 'd', 'e'];
    const scrollWidth = items.length * SLIDE_WIDTH + (items.length - 1) * 12;
    const clientWidth = 700;
    const maxScroll = scrollWidth - clientWidth;
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => scrollWidth });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => clientWidth });
    HTMLElement.prototype.scrollTo = function scrollTo(this: HTMLElement, options?: ScrollToOptions | number) {
      const left = Math.min(maxScroll, typeof options === 'object' ? (options.left ?? 0) : 0);
      scrolledTo.push(left);
      Object.defineProperty(this, 'scrollLeft', { configurable: true, value: left });
      fireEvent.scroll(this);
    };
    try {
      render(<SnapCarousel items={items} label="Stories" renderItem={item => <p>{item}</p>} />);
      setInView(true);
      for (let advance = 0; advance < 3; advance++) {
        act(() => {
          vi.advanceTimersByTime(5000);
        });
      }
      // Three advances: the third hits the end of the track, which is the last slide.
      expect(screen.getByText('5 / 5')).toBeTruthy();
      expect(screen.getByLabelText<HTMLButtonElement>('Next').disabled).toBe(true);

      // Back from the end moves the track one slide back from where it stands.
      fireEvent.click(screen.getByLabelText('Previous'));
      expect(scrolledTo[scrolledTo.length - 1]).toBe(2 * STEP);
      expect(screen.getByText('3 / 5')).toBeTruthy();

      // And from the end it wraps to the first slide by itself.
      fireEvent.click(screen.getByLabelText('Next'));
      expect(screen.getByText('5 / 5')).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(scrolledTo[scrolledTo.length - 1]).toBe(0);
      expect(screen.getByText('1 / 5')).toBeTruthy();
    } finally {
      delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollWidth;
      delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
    }
  });

  it('advances every 5s only while it is in view, and wraps', () => {
    renderCarousel();
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(scrolledTo).toEqual([]);

    setInView(true);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(scrolledTo).toEqual([STEP]);
    expect(screen.getByText('2 / 3')).toBeTruthy();

    setInView(false);
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(scrolledTo).toEqual([STEP]);

    setInView(true);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(scrolledTo).toEqual([STEP, STEP * 2, 0]);
  });

  it('waits only while it is pressed, then carries on', () => {
    renderCarousel();
    setInView(true);
    const carousel = screen.getByRole('group', { name: 'Example requests' });
    fireEvent.pointerDown(carousel);
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(scrolledTo).toEqual([]);

    // Released: one full interval later it advances, with nothing else asked of the visitor.
    // ...even when the press ends somewhere else on the page.
    fireEvent.pointerUp(window);
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(scrolledTo).toEqual([STEP]);
  });

  it('is not stopped by a wheel, a key or focus, and comes back every time it returns on screen', () => {
    renderCarousel();
    setInView(true);
    const carousel = screen.getByRole('group', { name: 'Example requests' });
    fireEvent.wheel(carousel);
    fireEvent.keyDown(carousel, { key: 'Tab' });
    fireEvent.focus(screen.getByLabelText('Next'));
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(scrolledTo).toEqual([STEP]);

    setInView(false);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(scrolledTo).toEqual([STEP]);
    setInView(true);
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(scrolledTo.length).toBe(2);
  });

  it('resumes a slide where it left off when it comes back on screen, never from the start', () => {
    renderCarousel();
    setInView(true);
    // 3 of the 5 seconds run, then it leaves the screen for a long time.
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    setInView(false);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(scrolledTo).toEqual([]);
    // Back: only the 2 seconds that were left, not a whole interval.
    setInView(true);
    act(() => {
      vi.advanceTimersByTime(1_900);
    });
    expect(scrolledTo).toEqual([]);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(scrolledTo).toEqual([STEP]);
  });

  it('has no pause button: it waits while keyboard focus is inside it, and carries on after', () => {
    renderCarousel();
    setInView(true);
    expect(screen.queryByLabelText('Pause')).toBeNull();
    const next = screen.getByLabelText('Next');
    // jsdom answers neither `:focus-visible` nor `:has()`: the keyboard being inside is stubbed on the element asked.
    let keyboardInside = true;
    const matches = vi.spyOn(Element.prototype, 'matches').mockImplementation(() => keyboardInside);
    act(() => {
      next.focus();
    });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(scrolledTo).toEqual([]);
    keyboardInside = false;
    act(() => {
      next.blur();
    });
    matches.mockRestore();
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(scrolledTo).toEqual([STEP]);
  });
});

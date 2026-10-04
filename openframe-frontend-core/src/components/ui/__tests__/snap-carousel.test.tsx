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

  it('stops for good once the visitor touches it', () => {
    renderCarousel();
    setInView(true);
    fireEvent.pointerDown(screen.getByRole('group', { name: 'Example requests' }));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(scrolledTo).toEqual([]);

    fireEvent.click(screen.getByLabelText('Next'));
    expect(scrolledTo).toEqual([STEP]);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(scrolledTo).toEqual([STEP]);
  });
});

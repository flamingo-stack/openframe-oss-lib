import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInView } from '../use-in-view';

interface Entry {
  isIntersecting: boolean;
  intersectionRatio: number;
  intersectionRect?: { height: number };
  rootBounds?: { height: number } | null;
}

describe('useInView', () => {
  let report: (entry: Entry) => void;
  let observedThresholds: number[];

  beforeEach(() => {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: (entries: Entry[]) => void, options: { threshold: number[] }) {
          report = entry => act(() => cb([entry]));
          observedThresholds = options.threshold;
        }
        observe() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  const mount = (threshold: number) => {
    const hook = renderHook(() => useInView<HTMLDivElement>({ threshold }));
    act(() => hook.result.current.ref(document.createElement('div')));
    return hook;
  };

  it('asks to be told at every step, so one report under the threshold is not the last word', () => {
    const { result } = mount(0.2);
    expect(observedThresholds.length).toBeGreaterThan(10);

    // The crossing itself is reported a hair under the threshold...
    report({ isIntersecting: true, intersectionRatio: 0.199 });
    expect(result.current.inView).toBe(false);
    // ...and the next step corrects it as the element keeps scrolling in.
    report({ isIntersecting: true, intersectionRatio: 0.25 });
    expect(result.current.inView).toBe(true);
  });

  it('follows the element out and back in, any number of times', () => {
    const { result } = mount(0.2);
    for (let i = 0; i < 3; i += 1) {
      report({ isIntersecting: true, intersectionRatio: 0.8 });
      expect(result.current.inView).toBe(true);
      report({ isIntersecting: false, intersectionRatio: 0 });
      expect(result.current.inView).toBe(false);
    }
  });

  it('counts an element taller than the viewport as in view once it fills enough of the viewport', () => {
    const { result } = mount(0.6);
    // 700px of a 3000px element is 23% of the element, but 70% of a 1000px viewport.
    report({
      isIntersecting: true,
      intersectionRatio: 0.23,
      intersectionRect: { height: 700 },
      rootBounds: { height: 1000 },
    });
    expect(result.current.inView).toBe(true);
    report({
      isIntersecting: true,
      intersectionRatio: 0.1,
      intersectionRect: { height: 300 },
      rootBounds: { height: 1000 },
    });
    expect(result.current.inView).toBe(false);
  });
});

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LazyMount } from '../lazy-mount';

type IOCallback = (entries: Array<{ isIntersecting: boolean; intersectionRatio: number; target: Element }>) => void;

describe('LazyMount', () => {
  let callbacks: IOCallback[];
  let observed: Element[];
  beforeEach(() => {
    callbacks = [];
    observed = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IOCallback) {
          callbacks.push(cb);
        }
        observe(el: Element) {
          observed.push(el);
        }
        unobserve() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders the placeholder until the box intersects, then the content, and stays mounted', () => {
    render(
      <LazyMount rootMargin="1px" placeholder={<span>placeholder</span>}>
        <span>player</span>
      </LazyMount>,
    );
    expect(screen.getByText('placeholder')).toBeTruthy();
    expect(screen.queryByText('player')).toBeNull();
    // The observed element IS the wrapper the hook registered — no DOM walking.
    const target = observed[observed.length - 1];
    const fire = callbacks[callbacks.length - 1];
    act(() => fire([{ isIntersecting: false, intersectionRatio: 0, target }]));
    expect(screen.queryByText('player')).toBeNull();
    act(() => fire([{ isIntersecting: true, intersectionRatio: 1, target }]));
    expect(screen.getByText('player')).toBeTruthy();
    expect(screen.queryByText('placeholder')).toBeNull();
  });
});

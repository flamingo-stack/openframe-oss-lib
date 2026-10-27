import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMobileActionBarHeight } from '../mobile-action-bar';
import { PageActions } from '../page-actions';

/** jsdom ships no ResizeObserver: this one reports on demand, at the height a test sets. */
const observers = new Set<() => void>();
let barHeight = 0;

function Probe() {
  return <span data-testid="height">{useMobileActionBarHeight()}</span>;
}

const height = () => Number(screen.getByTestId('height').textContent);
const resize = (next: number) => {
  barHeight = next;
  act(() => {
    for (const notify of observers) notify();
  });
};

describe('useMobileActionBarHeight', () => {
  beforeEach(() => {
    barHeight = 0;
    observers.clear();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        private readonly notify: () => void;
        constructor(callback: ResizeObserverCallback) {
          this.notify = () => callback([], this);
        }
        observe() {
          observers.add(this.notify);
        }
        disconnect() {
          observers.delete(this.notify);
        }
        unobserve() {}
      },
    );
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () => ({ height: barHeight }) as DOMRect,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('is 0 while no page draws the bar', () => {
    render(<Probe />);
    expect(height()).toBe(0);
  });

  it("follows the primary-buttons bar's height while it is mounted, and drops to 0 with it", () => {
    const { rerender } = render(
      <>
        <Probe />
        <PageActions variant="primary-buttons" actions={[{ label: 'Save', variant: 'accent', onClick: vi.fn() }]} />
      </>,
    );
    resize(96);
    expect(height()).toBe(96);

    // Hidden from md up: the bar measures 0.
    resize(0);
    expect(height()).toBe(0);

    resize(96);
    rerender(<Probe />);
    expect(height()).toBe(0);
  });
});

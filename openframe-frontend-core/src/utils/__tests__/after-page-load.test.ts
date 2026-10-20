// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { afterPageLoad } from '../after-page-load';

/** Install (or remove) a fake `requestIdleCallback` that queues the callbacks it is given. */
function stubIdle(queue: Array<() => void> | null) {
  const w = window as unknown as Record<string, unknown>;
  if (queue) w.requestIdleCallback = (cb: () => void) => queue.push(cb);
  else delete w.requestIdleCallback;
}

function setReadyState(state: DocumentReadyState) {
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => state });
}

describe('afterPageLoad', () => {
  afterEach(() => {
    vi.useRealTimers();
    stubIdle(null);
    setReadyState('complete');
  });

  it('waits for the load event, then for idle time', () => {
    setReadyState('loading');
    const idle: Array<() => void> = [];
    stubIdle(idle);
    const run = vi.fn();
    afterPageLoad(run);
    expect(idle).toHaveLength(0);
    window.dispatchEvent(new Event('load'));
    expect(run).not.toHaveBeenCalled();
    idle[0]();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('asks for idle time at once on a page that has already loaded', () => {
    setReadyState('complete');
    const idle: Array<() => void> = [];
    stubIdle(idle);
    const run = vi.fn();
    afterPageLoad(run);
    idle[0]();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('falls back to a timer where the browser has no idle callback', () => {
    vi.useFakeTimers();
    setReadyState('complete');
    const run = vi.fn();
    afterPageLoad(run);
    vi.runAllTimers();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('never runs once cancelled before the page loaded', () => {
    setReadyState('loading');
    const idle: Array<() => void> = [];
    stubIdle(idle);
    const run = vi.fn();
    const cancel = afterPageLoad(run);
    cancel();
    window.dispatchEvent(new Event('load'));
    expect(idle).toHaveLength(0);
    expect(run).not.toHaveBeenCalled();
  });
});

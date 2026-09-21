/**
 * MermaidDiagram's render effect re-runs on every `chart` change, and during
 * STREAMING the chart text grows chunk by chunk — so several renders are in
 * flight at once. Without a per-effect cancellation guard a slower EARLIER
 * render can resolve last and overwrite the newer output (and, on the error
 * path, paint an error for a chart that is no longer displayed).
 *
 * The 15s render timeout does not close this: it rejects the race, but does
 * not abort the underlying `mermaid.render`, so the stale write is merely
 * bounded, not prevented. These fixtures pin the guard.
 *
 * `mermaid` is mocked with a hand-settled deferred so resolution ORDER is
 * under the test's control. (The real-mermaid security fixture lives in
 * ./mermaid-security.test.ts and must stay unmocked, hence a separate file.)
 */
import { render, act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Deferred {
  chart: string;
  resolve: (value: { svg: string }) => void;
  reject: (err: Error) => void;
}

const renders: Deferred[] = [];

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(
      (_id: string, chart: string) =>
        new Promise<{ svg: string }>((resolve, reject) => {
          renders.push({ chart, resolve, reject });
        }),
    ),
  },
}));

import { MermaidDiagram } from '../mermaid-diagram';

/**
 * Let the mocked dynamic import + the resolved promise chain flush.
 *
 * MACROTASK-based and BOUNDED-POLLING on purpose. A fixed number of
 * `await Promise.resolve()` turns is NOT a settle condition here: the component
 * reaches `mermaid.render` through `mount effect → setMounted → re-render →
 * effect → await import('mermaid')`, and how many microtask turns a dynamic
 * import takes to resolve differs across Node/vitest releases. Three turns
 * happened to be enough on Node 22 and are NOT on Node 25, where the second
 * `mermaid.render` had not been called yet when the assertions ran — the suite
 * failed with `renders.length === 1` (and, once the real module leaked in, with
 * a genuine mermaid parse error). Poll for the condition instead of guessing a
 * tick count.
 */
const flushUntil = async (done: () => boolean, what: string) => {
  for (let i = 0; i < 50; i++) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    if (done()) return;
  }
  throw new Error(`timed out waiting for ${what}`);
};

/** Settle pending state updates when there is no specific condition to await. */
const flush = async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
};

/** Wait until `mermaid.render` has been called exactly `n` times. */
const flushRenders = (n: number) => flushUntil(() => renders.length >= n, `${n} mermaid.render call(s)`);

const svgOf = () => screen.queryByTestId('mermaid-svg-container')?.innerHTML ?? '';

describe('MermaidDiagram stale-render guard', () => {
  beforeEach(() => {
    renders.length = 0;
  });

  it('ignores an earlier render that resolves after a newer chart', async () => {
    const view = render(<MermaidDiagram chart="graph TD\n A-->B" />);
    await flushRenders(1);
    view.rerender(<MermaidDiagram chart="graph TD\n A-->B\n B-->C" />);
    await flushRenders(2);

    // Newer render lands first, then the abandoned earlier one. Settling a
    // deferred is not itself a React update — the `setSvg` happens in the
    // promise continuation, which `flush()` runs inside `act`.
    renders[1].resolve({ svg: '<svg id="new"></svg>' });
    await flush();
    renders[0].resolve({ svg: '<svg id="stale"></svg>' });
    await flush();

    expect(svgOf()).toContain('id="new"');
    expect(svgOf()).not.toContain('id="stale"');
  });

  it('ignores a late failure from an abandoned render', async () => {
    const view = render(<MermaidDiagram chart="graph TD\n A-->B" />);
    await flushRenders(1);
    view.rerender(<MermaidDiagram chart="graph TD\n A-->B\n B-->C" />);
    await flushRenders(2);

    renders[1].resolve({ svg: '<svg id="new"></svg>' });
    await flush();
    renders[0].reject(new Error('Diagram rendering timed out after 15000ms'));
    await flush();

    expect(view.container.textContent).not.toContain('Diagram Error');
    expect(svgOf()).toContain('id="new"');
  });

  /**
   * The error state must not be STICKY. This is the streaming hot path, not an
   * exotic case: the chart text grows chunk by chunk, every intermediate
   * prefix is an invalid diagram, and mermaid rejects each one. The render body
   * evaluates `error` BEFORE `svg`, so an uncleared message keeps the "Diagram
   * Error" card on screen for the component's whole lifetime — the finished
   * diagram never appears even though its render succeeded.
   */
  it('recovers from a transient failure once a later render succeeds', async () => {
    const view = render(<MermaidDiagram chart="graph TD" />);
    await flushRenders(1);

    // Partial chart → parse error, exactly what a mid-stream prefix produces.
    renders[0].reject(new Error('Parse error on line 1'));
    await flush();
    expect(view.container.textContent).toContain('Diagram Error');

    // The next delta completes the chart and renders cleanly.
    view.rerender(<MermaidDiagram chart="graph TD\n A-->B" />);
    await flushRenders(2);
    renders[1].resolve({ svg: '<svg id="settled"></svg>' });
    await flush();

    expect(view.container.textContent).not.toContain('Diagram Error');
    expect(svgOf()).toContain('id="settled"');
  });
});

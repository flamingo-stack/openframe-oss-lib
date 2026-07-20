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
import { render, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

interface Deferred {
  chart: string
  resolve: (value: { svg: string }) => void
  reject: (err: Error) => void
}

const renders: Deferred[] = []

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(
      (_id: string, chart: string) =>
        new Promise<{ svg: string }>((resolve, reject) => {
          renders.push({ chart, resolve, reject })
        }),
    ),
  },
}))

import { MermaidDiagram } from '../mermaid-diagram'

/** Let the mocked dynamic import + the resolved promise chain flush. */
const flush = async () => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

const svgOf = (container: HTMLElement) =>
  container.querySelector('.mermaid-svg-container')?.innerHTML ?? ''

describe('MermaidDiagram stale-render guard', () => {
  beforeEach(() => {
    renders.length = 0
  })

  it('ignores an earlier render that resolves after a newer chart', async () => {
    const view = render(<MermaidDiagram chart="graph TD\n A-->B" />)
    await flush()
    view.rerender(<MermaidDiagram chart="graph TD\n A-->B\n B-->C" />)
    await flush()
    expect(renders).toHaveLength(2)

    // Newer render lands first, then the abandoned earlier one.
    await act(async () => {
      renders[1]!.resolve({ svg: '<svg id="new"></svg>' })
    })
    await act(async () => {
      renders[0]!.resolve({ svg: '<svg id="stale"></svg>' })
    })
    await flush()

    expect(svgOf(view.container)).toContain('id="new"')
    expect(svgOf(view.container)).not.toContain('id="stale"')
  })

  it('ignores a late failure from an abandoned render', async () => {
    const view = render(<MermaidDiagram chart="graph TD\n A-->B" />)
    await flush()
    view.rerender(<MermaidDiagram chart="graph TD\n A-->B\n B-->C" />)
    await flush()

    await act(async () => {
      renders[1]!.resolve({ svg: '<svg id="new"></svg>' })
    })
    await act(async () => {
      renders[0]!.reject(new Error('Diagram rendering timed out after 15000ms'))
    })
    await flush()

    expect(view.container.textContent).not.toContain('Diagram Error')
    expect(svgOf(view.container)).toContain('id="new"')
  })
})

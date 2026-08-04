// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { useState } from 'react'
import {
  OverlayOpenRegistryProvider,
  useReportOverlayOpen,
} from '../overlay-open-registry'

/** Stand-in for `ActionsMenuDropdown` — reports its open state, renders nothing. */
function Overlay({ open }: { open: boolean }) {
  useReportOverlayOpen(open)
  return null
}

describe('OverlayOpenRegistry', () => {
  it('fires only on 0 → 1 and 1 → 0, not per overlay', () => {
    const onOpenChange = vi.fn()
    function Harness({ a, b }: { a: boolean; b: boolean }) {
      return (
        <OverlayOpenRegistryProvider onOpenChange={onOpenChange}>
          <Overlay open={a} />
          <Overlay open={b} />
        </OverlayOpenRegistryProvider>
      )
    }
    const { rerender } = render(<Harness a={false} b={false} />)
    expect(onOpenChange).not.toHaveBeenCalled()

    rerender(<Harness a b={false} />)
    expect(onOpenChange.mock.calls).toEqual([[true]])

    // Second overlay opens while the first is still open — no new signal.
    rerender(<Harness a b />)
    expect(onOpenChange.mock.calls).toEqual([[true]])

    // First closes, one still open — still no signal.
    rerender(<Harness a={false} b />)
    expect(onOpenChange.mock.calls).toEqual([[true]])

    rerender(<Harness a={false} b={false} />)
    expect(onOpenChange.mock.calls).toEqual([[true], [false]])
  })

  it('releases when an open overlay unmounts', () => {
    const onOpenChange = vi.fn()
    function Harness({ mounted }: { mounted: boolean }) {
      return (
        <OverlayOpenRegistryProvider onOpenChange={onOpenChange}>
          {mounted ? <Overlay open /> : null}
        </OverlayOpenRegistryProvider>
      )
    }
    const { rerender } = render(<Harness mounted />)
    expect(onOpenChange.mock.calls).toEqual([[true]])
    rerender(<Harness mounted={false} />)
    expect(onOpenChange.mock.calls).toEqual([[true], [false]])
  })

  it('is inert without a provider — no throw, no crash', () => {
    expect(() => render(<Overlay open />)).not.toThrow()
  })

  it('a stable context value keeps overlays from re-rendering on count changes', () => {
    const renderSpy = vi.fn()
    function CountingOverlay({ open }: { open: boolean }) {
      renderSpy()
      useReportOverlayOpen(open)
      return null
    }
    let bump: (() => void) | undefined
    function Harness() {
      const [, setTick] = useState(0)
      bump = () => setTick((t) => t + 1)
      return (
        <OverlayOpenRegistryProvider>
          <CountingOverlay open={false} />
        </OverlayOpenRegistryProvider>
      )
    }
    render(<Harness />)
    const before = renderSpy.mock.calls.length
    act(() => bump?.())
    // One re-render from the parent's own state, not extra churn from context.
    expect(renderSpy.mock.calls.length).toBe(before + 1)
  })
})

import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoardColumnDef } from '../components/features/board/types'

/**
 * Wiring, not integration.
 *
 * `drop-target.ts` is unit-tested on its own, but its rules only matter if the
 * board actually calls them, and at the right moment. That half was proved by
 * hand — dragging in a browser and counting `onDragOver` dispatches — which is
 * exactly the kind of proof that does not survive the next refactor. This test
 * holds the seam: drop `dropTarget.freeze()` out of `handleDragOver`, or stop
 * settling on the committed list, and it fails.
 *
 * A real drag is out of reach here: jsdom has no layout, so every rect is zero
 * and dnd-kit's collision detection has nothing to rank. The handlers are driven
 * directly instead, with the event shapes dnd-kit passes them.
 */

// jsdom has no ResizeObserver, and `useHorizontalScrollbar` constructs one in a
// layout effect — so `Board` throws on render before it can be driven. Inert on
// purpose: there is no layout here for a real one to report on.
//
// Scoped to this file rather than `vitest.setup.ts`: defining it globally makes
// the `sanitize-render` and `embed-viewer-frame` suites fail on media-chrome's
// module-level `globalThis.matchMedia` call. Whatever load order that perturbs
// is pre-existing and not this PR's to untangle.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
}

const resolver = vi.hoisted(() => ({
  detect: vi.fn(() => []),
  freeze: vi.fn(),
  release: vi.fn(),
  dispose: vi.fn(),
}))

const dnd = vi.hoisted(() => ({ props: null as Record<string, (event: unknown) => void> | null }))

vi.mock('../components/features/board/drop-target', () => ({
  useDropTarget: () => resolver,
}))

vi.mock('@dnd-kit/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>()
  return {
    ...actual,
    DndContext: (props: { children?: unknown }) => {
      dnd.props = props as Record<string, (event: unknown) => void>
      return props.children
    },
    DragOverlay: () => null,
  }
})

// The lanes render nothing: this is about `Board`'s handlers, and the real ones
// pull in icons, links and a sortable context that need a live DndContext.
vi.mock('../components/features/board/board-column', () => ({ BoardColumn: () => null }))
vi.mock('../components/features/board/ticket-card', () => ({ TicketCard: () => null }))

const { Board } = await import('../components/features/board/board')

const ticket = (id: string, status: string) => ({ id, title: id, ticketNumber: `#${id}`, status })
const COLUMNS: BoardColumnDef[] = [
  { id: 'a', label: 'A', color: '#111111', tickets: [ticket('a1', 'a')] },
  { id: 'b', label: 'B', color: '#222222', tickets: [ticket('b1', 'b')] },
]

/** `a1` dragged from lane `a` onto `b1` in lane `b` — the cross-lane move. */
const CROSS_LANE_OVER = {
  active: { id: 'a1', rect: { current: { translated: { top: 200, height: 100 } } } },
  over: { id: 'b1', rect: { top: 0, height: 100 }, data: { current: { columnId: 'b', type: 'ticket' } } },
  delta: { x: 0, y: 0 },
}

describe('Board drag guard wiring', () => {
  beforeEach(() => {
    for (const spy of Object.values(resolver)) spy.mockClear()
    dnd.props = null
  })

  it('hands its collision detection to DndContext', () => {
    render(<Board columns={COLUMNS} onChange={() => {}} />)
    expect(dnd.props?.collisionDetection).toBe(resolver.detect)
  })

  it('freezes the target before the state update that moves a card across lanes', () => {
    render(<Board columns={COLUMNS} onChange={() => {}} />)
    act(() => dnd.props?.onDragStart({ active: { id: 'a1' } }))
    expect(resolver.freeze).not.toHaveBeenCalled()

    act(() => dnd.props?.onDragOver(CROSS_LANE_OVER))
    expect(resolver.freeze).toHaveBeenCalledTimes(1)
  })

  it('leaves the target alone while the pointer stays inside one lane', () => {
    // Sorting within a lane re-lays nothing out across parents, so there is no
    // re-measure cascade to guard against — freezing here would only make the
    // board ignore the pointer for a frame.
    render(<Board columns={COLUMNS} onChange={() => {}} />)
    act(() => dnd.props?.onDragStart({ active: { id: 'a1' } }))
    act(() =>
      dnd.props?.onDragOver({
        ...CROSS_LANE_OVER,
        over: { ...CROSS_LANE_OVER.over, id: 'a1', data: { current: { columnId: 'a', type: 'ticket' } } },
      }),
    )
    expect(resolver.freeze).not.toHaveBeenCalled()
  })

  it('releases the guard when a drag ends and when it is cancelled', () => {
    render(<Board columns={COLUMNS} onChange={() => {}} />)

    act(() => dnd.props?.onDragStart({ active: { id: 'a1' } }))
    act(() => dnd.props?.onDragEnd({ active: { id: 'a1' }, over: null }))
    expect(resolver.release).toHaveBeenCalled()

    resolver.release.mockClear()
    act(() => dnd.props?.onDragStart({ active: { id: 'a1' } }))
    act(() => dnd.props?.onDragCancel({}))
    expect(resolver.release).toHaveBeenCalled()
  })

})

// `settle` on the committed list and `dispose` on unmount used to be wired here
// too, and were tested here. They now live inside `useDropTarget`, next to the
// rules they protect, so the board cannot forget them and there is nothing left
// to assert about — see `useDropTarget` in `board-drop-target.test.ts`.

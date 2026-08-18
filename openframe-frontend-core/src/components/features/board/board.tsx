'use client'

import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine'
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { preventUnhandled } from '@atlaskit/pragmatic-drag-and-drop/utils/prevent-unhandled'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useHorizontalScrollbar } from '../../../hooks/ui/use-horizontal-scrollbar'
import { useIsomorphicLayoutEffect } from '../../../hooks/ui/use-isomorphic-layout-effect'
import { autoScrollAncestors, autoScrollBothWays } from '../../../utils/auto-scroll-ancestors'
import { nearestScrollableAncestor } from '../../../utils/scroll-parent'
import { cn } from '../../../utils/cn'
import { BoardColumn } from './board-column'
import { BoardLiftContext, type DropAim, DropAimContext, isSameAim } from './drop-aim'
import { aimAnchor, aimFromTarget, aimToChange, type ArrowKey, type BoardAim, initialAim, laneOf, moveAim } from './aim'
import { cardById, DROP_LINE_ATTRIBUTE } from './lane-geometry'
import { DRAG_PREVIEW_OPACITY, TicketCardView } from './ticket-card'
import { applyPendingMove, hasMoveSettled, LandingCardContext, type PendingMove } from './pending-move'
import { resolveBoardDrop } from './resolve-drop'
import type { BoardChange, BoardColumnDef, BoardTicket } from './types'
import { useBoardCollapse } from './use-board-collapse'

/** How long the board may keep standing in for `columns` while waiting for the
 *  host's answer. Only a host that drops the change on the floor ever reaches
 *  this — it exists so a failed move can't be shown as done forever, not as a
 *  timing assumption. */
const PENDING_MOVE_TIMEOUT_MS = 2000

/** How long a dropped card takes to travel from the pointer into its slot. */
const DROP_MS = 160
const DROP_EASING = 'cubic-bezier(0.2, 0, 0, 1)'

/** Above the header, modals and drawers, below toasts — a card being carried
 *  has to clear everything it is being carried over. */
const DRAG_PREVIEW_Z = 1400

const ARROW_KEYS: ArrowKey[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']

/** What it takes to draw the carried card again, at rest, exactly where the
 *  browser's drag image was when it was let go. Measured once at drag start. */
interface DragGeometry {
  ticket: BoardColumnDef['tickets'][number]
  columnColor?: string
  width: number
  /** Pointer-to-card-corner offset, so the copy lands under the same grip. */
  grabX: number
  grabY: number
}

/** The short-lived copy that glides into the slot after a drop. */
interface LandingPreview extends DragGeometry {
  /** Where the pointer was when the card was released. */
  startX: number
  startY: number
}

export interface BoardProps {
  columns: BoardColumnDef[]
  onChange: (change: BoardChange) => void
  onLoadMore?: (columnId: string) => void
  onAddTicket?: (columnId: string) => void
  onArchiveColumn?: (columnId: string) => void
  getTicketHref?: (ticketId: string) => string
  renderAssignSlot?: (ticket: BoardColumnDef['tickets'][number]) => ReactNode
  onApprove?: (ticketId: string, requestId?: string) => void | Promise<void>
  onReject?: (ticketId: string, requestId?: string) => void | Promise<void>
  collapseStorageKey?: string
  loadMoreRootMargin?: string
  className?: string
}

/**
 * The board renders `columns` and nothing else — there is no local mirror of
 * them, and a drag in progress changes no state here at all.
 *
 * That is the whole design. A card that previews its move by actually moving in
 * the data has to re-enter React on every lane crossing, which re-mounts it
 * under a new parent and re-measures the board; guarding that cascade is what
 * the old dnd-kit implementation spent a frame-freeze and a unit-tested rules
 * module on. Here the preview is a line drawn by the card being hovered, the
 * data moves once, on drop, and the cascade has nothing to feed on.
 */
export function Board({
  columns,
  onChange,
  onLoadMore,
  onAddTicket,
  onArchiveColumn,
  getTicketHref,
  renderAssignSlot,
  onApprove,
  onReject,
  collapseStorageKey,
  loadMoreRootMargin,
  className,
}: BoardProps) {
  const { collapsed, toggle } = useBoardCollapse(collapseStorageKey)

  const {
    scrollRef,
    trackRef,
    thumbRef,
    thumbRatio,
    onScroll,
    onTrackClick,
    onTrackWheel,
    onThumbPointerDown,
    onThumbPointerMove,
    onThumbPointerUp,
  } = useHorizontalScrollbar()

  // The monitor is registered once for the board's lifetime; these keep it
  // reading current values without tearing it down on every render.
  const columnsRef = useRef(columns)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // `useHorizontalScrollbar` hands back a callback ref, and auto-scroll needs
  // the node itself — so keep our own alongside it on the same element.
  const boardRef = useRef<HTMLDivElement | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const setScroller = useCallback(
    (node: HTMLDivElement | null) => {
      scrollerRef.current = node
      scrollRef(node)
    },
    [scrollRef],
  )

  // Where the drop points. One answer for the whole board, handed to the cards
  // so the preview follows it wherever it came from — see `drop-aim.ts`.
  const [aim, setAim] = useState<DropAim | null>(null)

  // A card lifted with the keyboard. Jira's model, and the only one that works
  // here: an arrow key cannot commit a move of its own, because each one would
  // be a separate write to the server — so the card is lifted, walked to where
  // it belongs, and put down once.
  const [lifted, setLifted] = useState<{ ticketId: string; aim: BoardAim } | null>(null)
  const [announcement, setAnnouncement] = useState('')

  // The card being carried is the browser's own drag image (see
  // `ticket-card.tsx`), so nothing here follows the pointer and a drag re-renders
  // nothing. This is measured at drag start and only used at the end, to put a
  // copy back where that image was and glide it into place.
  const dragGeometry = useRef<DragGeometry | null>(null)
  const [landingPreview, setLandingPreview] = useState<LandingPreview | null>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)

  // A move that has been reported but not answered yet. The board shows it
  // itself for that gap — see `pending-move.ts` for why the card cannot simply
  // wait for the host, and why waiting is what made a drop look like the ticket
  // disappearing and reappearing.
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)
  const view = useMemo(() => (pendingMove ? applyPendingMove(columns, pendingMove) : columns), [columns, pendingMove])
  // EVERYTHING downstream reads `view`, never `columns`: it is what is on
  // screen, so it is also what a drag, a keyboard move and a drop are about.
  // `columns` is only ever consulted to ask whether the host has caught up.
  columnsRef.current = view

  // The card still travelling from the pointer into the slot it landed in. The
  // preview is over it for that moment, so the card itself is hidden.
  const [landing, setLanding] = useState<string | null>(null)
  const landingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Where the pointer was last seen, in the same terms the preview is placed. */
  const pointRef = useRef({ x: 0, y: 0 })

  // ---- keyboard move -------------------------------------------------------

  const laneLabel = useCallback(
    (columnId: string) => view.find(c => c.id === columnId)?.label ?? columnId,
    [view],
  )

  /** Lanes the lifted card is allowed into — the same rules a pointer drop obeys. */
  const acceptsLifted = useCallback(
    (fromColumnId: string) => (column: BoardColumnDef) => {
      if (column.dropDisabled || collapsed[column.id]) return false
      if (column.id === fromColumnId) return true
      return !column.allowedFromColumns || column.allowedFromColumns.includes(fromColumnId)
    },
    [collapsed],
  )

  const lift = useCallback(
    (ticketId: string) => {
      const start = initialAim(view, ticketId)
      if (!start) return
      setLifted({ ticketId, aim: start })
      const title = laneOf(view, ticketId)?.tickets.find(t => t.id === ticketId)?.title ?? 'Ticket'
      setAnnouncement(`${title} lifted. Use the arrow keys to move it, space to drop it, escape to put it back.`)
    },
    [view],
  )

  const drop = useCallback(() => {
    if (!lifted) return
    const change = aimToChange(view, lifted.ticketId, lifted.aim)
    setLifted(null)
    if (!change) {
      setAnnouncement('Put back where it was.')
      return
    }
    setAnnouncement(`Dropped into ${laneLabel(change.toColumnId)}.`)
    setPendingMove({
      ticketId: change.ticketId,
      fromColumnId: change.fromColumnId,
      toColumnId: change.toColumnId,
      afterTicketId: change.afterTicketId,
    })
    onChange(change)
  }, [lifted, view, laneLabel, onChange])

  const walk = useCallback(
    (key: ArrowKey) => {
      if (!lifted) return
      const from = laneOf(view, lifted.ticketId)?.id ?? lifted.aim.columnId
      const next = moveAim(view, lifted.ticketId, lifted.aim, key, acceptsLifted(from))
      if (next === lifted.aim) return
      setLifted({ ...lifted, aim: next })
      const total = (view.find(c => c.id === next.columnId)?.tickets ?? []).filter(
        t => t.id !== lifted.ticketId,
      ).length
      setAnnouncement(`${laneLabel(next.columnId)}, position ${next.index + 1} of ${total + 1}.`)
    },
    [lifted, view, acceptsLifted, laneLabel],
  )

  // Handled on the board rather than on each card: once a card is lifted the
  // keys belong to the move, not to whatever happens to hold focus.
  useEffect(() => {
    if (!lifted) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLifted(null)
        setAnnouncement('Move cancelled.')
      } else if (event.key === ' ' || event.key === 'Enter') {
        drop()
      } else if (ARROW_KEYS.includes(event.key as ArrowKey)) {
        walk(event.key as ArrowKey)
      } else {
        return
      }
      // Arrows would scroll the lane out from under the card, and space would
      // scroll the page.
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lifted, drop, walk])

  // A card walked with the keyboard has to be visible where it is being walked
  // to. A pointer drag brings its own scrolling — auto-scroll follows it to the
  // edges — but arrow keys move nothing on screen, so a slot below the fold, or
  // in a lane scrolled off the side of the board, was being aimed at completely
  // out of sight. `lifted` is a new object on every step, so this runs per step.
  useEffect(() => {
    if (!lifted) return
    boardRef.current?.querySelector(`[${DROP_LINE_ATTRIBUTE}]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [lifted])

  /** The lifted card feeds the same preview a pointer drag does, so the room
   *  opening and the faded copy need to know nothing about keyboards. */
  const keyboardAim = useMemo<DropAim | null>(() => {
    if (!lifted) return null
    const ticket = laneOf(view, lifted.ticketId)?.tickets.find(t => t.id === lifted.ticketId)
    if (!ticket) return null
    const anchor = aimToChange(view, lifted.ticketId, lifted.aim)
      ? aimAnchor(view, lifted.ticketId, lifted.aim)
      : { ticketId: null, edge: null }
    return { columnId: lifted.aim.columnId, ...anchor, ticket }
  }, [lifted, view])

  // Deliberately reads the RAW `columns` — the question is whether the host has
  // caught up, and `view` already has the answer painted into it.
  useEffect(() => {
    if (!pendingMove) return
    // Handing back once the move has landed matters: a host that rolls a failed
    // move back puts the card in its old slot, and a `pendingMove` still sitting
    // here would keep showing the move as though it had worked.
    if (hasMoveSettled(columns, pendingMove)) {
      setPendingMove(null)
      return
    }
    const timer = setTimeout(() => setPendingMove(null), PENDING_MOVE_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [columns, pendingMove])

  useEffect(() => {
    const scroller = scrollerRef.current

    /** What the innermost drop target is currently saying, in the one shape the
     *  cards need. A card and a lane answer in the same terms, so this does not
     *  care which one replied — and nothing outside a lane replies at all. */
    const readAim = (source: { data: Record<string | symbol, unknown> }, target?: Record<string | symbol, unknown>) => {
      const ticket = source.data.ticket as BoardTicket | undefined
      if (!target || !ticket) return null
      const ticketId = String(source.data.ticketId)
      const slot = aimFromTarget(columnsRef.current, ticketId, target)
      if (!slot) return null
      // No line where the card already is. A drop there changes nothing, and
      // marking a place that is not a move is noise around the card you are
      // holding — the one thing every board gets right by NOT drawing it.
      const anchor = aimToChange(columnsRef.current, ticketId, slot)
        ? aimAnchor(columnsRef.current, ticketId, slot)
        : { ticketId: null, edge: null }
      return { columnId: slot.columnId, ...anchor, ticket }
    }

    const aimAt = (
      source: { data: Record<string | symbol, unknown> },
      targets: { data: Record<string | symbol, unknown> }[],
    ) => {
      const next = readAim(source, targets[0]?.data)
      // A pointer moving inside one card re-resolves to the same answer every
      // frame; keeping the previous object stops that re-rendering the board.
      setAim(prev => (isSameAim(prev, next) ? prev : next))
    }

    return combine(
      // Dragging towards the edge of the board scrolls the lanes sideways —
      // and keeps scrolling once the pointer is past that edge.
      scroller ? autoScrollBothWays(scroller) : () => {},
      // ...and towards the edge of the SCREEN scrolls whatever the page is
      // actually scrolled by, which is the layout's `<main>`, not the document.
      // Auto-scroll is registered on those; a DROP is not. Nothing outside the
      // lanes is a drop target: a card carried over the filters, the header or
      // the sidebar is aimed at nothing, draws nothing, and cancels when
      // released. Resolving a lane from a pointer that has left the board — by
      // matching it horizontally to the column above or below it — was tried and
      // is not what a board does; the answer has to be somewhere the user is
      // actually pointing.
      monitorForElements({
        canMonitor: ({ source }) => source.data.type === 'ticket',

        onDragStart: ({ source, location }) => {
          const ticket = source.data.ticket as BoardColumnDef['tickets'][number] | undefined
          if (!ticket) return
          const rect = source.element.getBoundingClientRect()
          const { clientX, clientY } = location.current.input
          pointRef.current = { x: clientX, y: clientY }
          // Nothing outside the lanes is a drop target, and a native drag with
          // no target under it falls back to the browser's own drop effect —
          // which is `copy`, i.e. the green plus cursor, over the filters, the
          // header and the sidebar. This is Pragmatic's own answer: it holds the
          // effect at `move` everywhere, so the cursor stays a plain drag cursor
          // wherever the card is carried. It changes nothing about WHERE the
          // card can land — the board still resolves that from its own targets,
          // and releasing outside them still cancels.
          preventUnhandled.start()
          // A previous card may still be gliding into place; this drag owns the
          // preview from here, so that one arrives instantly instead.
          setLanding(null)
          dragGeometry.current = {
            ticket,
            columnColor: columnsRef.current.find(c => c.id === source.data.columnId)?.color,
            width: rect.width,
            grabX: clientX - rect.left,
            grabY: clientY - rect.top,
          }
        },

        onDropTargetChange: ({ source, location }) => aimAt(source, location.current.dropTargets),

        onDrag: ({ source, location }) => {
          // The edge can flip without the set of targets changing, so the aim is
          // re-read here too — `onDrag` is throttled to an animation frame.
          aimAt(source, location.current.dropTargets)
          const { clientX, clientY } = location.current.input
          pointRef.current = { x: clientX, y: clientY }
        },

        onDrop: ({ source, location }) => {
          preventUnhandled.stop()
          setAim(null)
          // Innermost first: a card if the pointer was over one, otherwise the
          // lane it was dropped into. Empty means dropped outside the board.
          const change = resolveBoardDrop(columnsRef.current, {
            source: source.data,
            target: location.current.dropTargets[0]?.data,
          })
          // Released where nothing would change, or outside the board entirely.
          // The browser takes its drag image away by itself and the card un-fades
          // on its own `onDrop`, in this same event, so there is nothing to undo.
          if (!change) return

          // The move goes on screen NOW, from here, and the host's answer
          // replaces an identical picture whenever it arrives.
          setPendingMove({
            ticketId: change.ticketId,
            fromColumnId: change.fromColumnId,
            toColumnId: change.toColumnId,
            afterTicketId: change.afterTicketId,
          })
          // ...and a copy of the card takes over from the drag image for one
          // short glide into the slot that move just opened. Both land in the
          // same commit, so the slot is already there to be measured — see the
          // effect below.
          const geometry = dragGeometry.current
          if (geometry) {
            setLandingPreview({ ...geometry, startX: pointRef.current.x, startY: pointRef.current.y })
            setLanding(change.ticketId)
          }
          onChangeRef.current(change)
        },
      }),
    )
  }, [])

  /**
   * The dropped card's glide from where it was released into its slot.
   *
   * Runs in the commit that carries the move itself, so the slot already exists
   * and can be measured; the card in it is hidden (see `LandingCardContext`) and
   * this copy is what the eye follows the rest of the way. Without it the
   * browser's drag image simply vanishes at the pointer and the card is suddenly
   * elsewhere — the discontinuity the whole drop sequence exists to remove.
   *
   * A plain FLIP, written out rather than split between the render and here: the
   * copy is placed where the drag image was, that position is forced to resolve,
   * and only then is it given a destination. Skipping the forced resolve means
   * the browser only ever sees the final value and animates from nothing — an
   * element's very first style resolution never starts a transition.
   */
  useIsomorphicLayoutEffect(() => {
    if (!landing) return

    const finish = () => {
      landingTimer.current = null
      setLanding(null)
      setLandingPreview(null)
    }

    const preview = previewRef.current
    const card = boardRef.current && cardById(boardRef.current, landing)
    if (!preview || !landingPreview || !card) {
      finish()
      return
    }

    const to = card.getBoundingClientRect()
    // The slot has to be somewhere the eye can actually follow the card to. A
    // lane clips its own overflow, so a slot hanging over its edge would take a
    // card that is whole one frame and cut in half the next; the card simply
    // appears in place instead, which is never wrong — only less pretty.
    const lane = nearestScrollableAncestor(card)?.getBoundingClientRect()
    if (lane && (to.top < lane.top || to.bottom > lane.bottom)) {
      finish()
      return
    }

    const { startX, startY } = landingPreview
    preview.style.transition = 'none'
    preview.style.opacity = String(DRAG_PREVIEW_OPACITY)
    preview.style.transform = `translate(${startX}px, ${startY}px)`
    const from = preview.getBoundingClientRect()
    void preview.offsetHeight

    // Settles solid as it lands, so handing over to the real card underneath is
    // not also a jump in brightness.
    preview.style.transition = `transform ${DROP_MS}ms ${DROP_EASING}, opacity ${DROP_MS}ms ${DROP_EASING}`
    preview.style.opacity = '1'
    preview.style.transform = `translate(${startX + to.left - from.left}px, ${startY + to.top - from.top}px)`
    landingTimer.current = setTimeout(finish, DROP_MS)
    return () => {
      if (landingTimer.current) clearTimeout(landingTimer.current)
      landingTimer.current = null
    }
  }, [landing, landingPreview])

  // The released card, on its way into its slot. Alive for one short animation
  // and no longer: while the card is actually being carried there is nothing
  // here at all — that is the browser's drag image (see `ticket-card.tsx`).
  //
  // A portal, because a lane clips its own overflow and this travels across the
  // whole board. Position, opacity and transition are all written by the effect
  // above and deliberately not by React: a re-render for an unrelated reason
  // must not put the card back at the pointer half way down.
  const preview =
    landingPreview &&
    createPortal(
      <div
        ref={previewRef}
        aria-hidden
        // `[&_*]:!pointer-events-none` and not just the root: the card body
        // re-enables pointer events on its own parts (the assignee slot, the
        // timestamp tooltip), and this sits over the board while it settles.
        className="pointer-events-none fixed left-0 top-0 [&_*]:!pointer-events-none"
        style={{
          zIndex: DRAG_PREVIEW_Z,
          width: landingPreview.width,
          // The grip offset lives here, so the animated property is a plain
          // translate in pointer coordinates and nothing else.
          margin: `${-landingPreview.grabY}px 0 0 ${-landingPreview.grabX}px`,
        }}
      >
        {/* Rendered with the host's assignee slot, like the drag image it takes
            over from: without it the card visibly changes at the handover. It is
            a live control, but an inert copy of one — nothing in this subtree
            can be pointed at (see above) — and it shares its queries with the
            card it was copied from. */}
        <TicketCardView
          ticket={landingPreview.ticket}
          columnColor={landingPreview.columnColor}
          renderAssignSlot={renderAssignSlot}
          // Still held, to match the drag image at the moment it hands over.
          className="shadow-card-hover"
        />
      </div>,
      document.body,
    )

  return (
    <LandingCardContext.Provider value={landing}>
      <DropAimContext.Provider value={aim ?? keyboardAim}>
        <BoardLiftContext.Provider value={lift}>
          {preview}
          <div ref={boardRef} className={cn('flex flex-col h-full', className)}>
            <div
              ref={setScroller}
              onScroll={onScroll}
              className="flex flex-1 min-h-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {view.map((column, i) => {
                const prev = view[i - 1]
                const next = view[i + 1]
                const joinLeft = !!(column.system && prev?.system)
                const joinRight = !!(column.system && next?.system)
                const showGap = i > 0 && !joinLeft
                return (
                  <Fragment key={column.id}>
                    {showGap && <div aria-hidden className="w-[var(--spacing-system-mf)] shrink-0" />}
                    <BoardColumn
                      column={column}
                      collapsed={!!collapsed[column.id]}
                      onToggleCollapse={toggle}
                      onAddTicket={onAddTicket}
                      onArchive={onArchiveColumn}
                      getTicketHref={getTicketHref}
                      renderAssignSlot={renderAssignSlot}
                      onApprove={onApprove}
                      onReject={onReject}
                      onLoadMore={onLoadMore}
                      loadMoreRootMargin={loadMoreRootMargin}
                      joinLeft={joinLeft}
                      joinRight={joinRight}
                    />
                  </Fragment>
                )
              })}
            </div>

            <p aria-live="polite" className="sr-only">
              {announcement}
            </p>

            {thumbRatio > 0 && (
              <div
                ref={trackRef}
                onClick={onTrackClick}
                onWheel={onTrackWheel}
                className="relative h-2 mt-[var(--spacing-system-mf)] rounded-full bg-ods-border cursor-pointer shrink-0"
              >
                <div
                  ref={thumbRef}
                  data-scrollbar-thumb
                  className="absolute top-0 h-full rounded-full bg-ods-text-secondary transition-colors"
                  style={{ width: `${thumbRatio * 100}%`, cursor: 'grab' }}
                  onPointerDown={onThumbPointerDown}
                  onPointerMove={onThumbPointerMove}
                  onPointerUp={onThumbPointerUp}
                />
              </div>
            )}
          </div>
        </BoardLiftContext.Provider>
      </DropAimContext.Provider>
    </LandingCardContext.Provider>
  )
}

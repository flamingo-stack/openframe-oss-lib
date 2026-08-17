'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useHorizontalScrollbar } from '../../../hooks/ui/use-horizontal-scrollbar'
import { cn } from '../../../utils/cn'
import { BoardColumn } from './board-column'
import { createDropTargetResolver } from './drop-target'
import { TicketCard } from './ticket-card'
import type { BoardChange, BoardColumnDef, BoardTicket } from './types'
import { useBoardCollapse } from './use-board-collapse'

export interface BoardProps {
  columns: BoardColumnDef[]
  onChange: (change: BoardChange) => void
  onLoadMore?: (columnId: string) => void
  onAddTicket?: (columnId: string) => void
  onArchiveColumn?: (columnId: string) => void
  getTicketHref?: (ticketId: string) => string
  renderAssignSlot?: (ticket: BoardTicket) => ReactNode
  onApprove?: (ticketId: string, requestId?: string) => void | Promise<void>
  onReject?: (ticketId: string, requestId?: string) => void | Promise<void>
  collapseStorageKey?: string
  loadMoreRootMargin?: string
  className?: string
}

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

  const [items, setItems] = useState<BoardColumnDef[]>(columns)
  const isDraggingRef = useRef(false)

  useEffect(() => {
    if (!isDraggingRef.current) setItems(columns)
  }, [columns])

  const dragOriginRef = useRef<{ ticketId: string; fromColumnId: string } | null>(null)
  const [activeTicket, setActiveTicket] = useState<{ ticket: BoardTicket; columnId: string } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Same collision policy as before, plus the two rules that stop a cross-column
  // move from triggering the next one — see `drop-target.ts`. Kept out of React
  // so both rules are unit-testable frame by frame.
  const dropTarget = useMemo(() => createDropTargetResolver(), [])
  useEffect(() => dropTarget.dispose, [dropTarget])

  // Keep a freeze alive across the commit that caused it — see `settle`. Keyed
  // on `items` because that is the state whose change re-measures the lanes.
  useEffect(() => {
    dropTarget.settle()
  }, [items, dropTarget])

  // One stable handler per column id. `onToggleCollapse` keeps its zero-arg
  // shape (public prop), but an inline arrow would hand every lane a new
  // function on every drag frame and defeat `BoardColumn`'s memo — which is the
  // whole point of only rebuilding the lanes a move touches.
  const toggleRef = useRef(toggle)
  toggleRef.current = toggle
  const collapseHandlers = useRef(new Map<string, () => void>())
  const collapseHandlerFor = useCallback((columnId: string) => {
    let handler = collapseHandlers.current.get(columnId)
    if (!handler) {
      handler = () => toggleRef.current(columnId)
      collapseHandlers.current.set(columnId, handler)
    }
    return handler
  }, [])

  const handleDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id)
    const located = locate(items, id)
    if (!located) return
    dropTarget.release()
    isDraggingRef.current = true
    dragOriginRef.current = { ticketId: id, fromColumnId: located.columnId }
    setActiveTicket({ ticket: located.ticket, columnId: located.columnId })
  }

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return

    const overData = over.data.current as { columnId?: string; type?: string } | undefined
    const fromColumnId = locate(items, activeId)?.columnId
    const toColumnId = overData?.columnId
    if (!fromColumnId || !toColumnId || fromColumnId === toColumnId) return

    const origin = dragOriginRef.current
    const isReturnToOrigin = origin?.fromColumnId === toColumnId
    const targetCol = items.find(c => c.id === toColumnId)
    const blockedBySource =
      !isReturnToOrigin &&
      !!targetCol?.allowedFromColumns &&
      !!origin &&
      !targetCol.allowedFromColumns.includes(origin.fromColumnId)
    if ((targetCol?.dropDisabled && !isReturnToOrigin) || blockedBySource) return

    // The move below re-mounts the card under another parent, so dnd-kit
    // unregisters + re-registers its droppable and re-measures every rect, then
    // dispatches `onDragOver` again from the effect keyed on the over id. Hold
    // the target for one frame so that cascade cannot schedule the next move —
    // otherwise the two columns pass the card back and forth inside a single
    // commit until React aborts the tree with "Maximum update depth exceeded".
    dropTarget.freeze()

    setItems(prev => {
      const fromIndex = findIndexInColumn(prev, fromColumnId, activeId)
      const toCol = prev.find(c => c.id === toColumnId)
      if (fromIndex < 0 || !toCol) return prev

      let toIndex: number
      if (overData?.type === 'column') {
        toIndex = toCol.tickets.length
      } else {
        const overIndex = toCol.tickets.findIndex(t => t.id === overId)
        if (overIndex < 0) {
          toIndex = toCol.tickets.length
        } else {
          const activeRect = active.rect.current.translated
          const overRect = over.rect
          const isBelow = !!activeRect && activeRect.top > overRect.top + overRect.height / 2
          toIndex = overIndex + (isBelow ? 1 : 0)
        }
      }

      const next = prev.map(c =>
        c.id === fromColumnId || c.id === toColumnId ? { ...c, tickets: [...c.tickets] } : c,
      )
      const nextFrom = next.find(c => c.id === fromColumnId)
      const nextTo = next.find(c => c.id === toColumnId)
      if (!nextFrom || !nextTo) return prev
      const [moved] = nextFrom.tickets.splice(fromIndex, 1)
      nextTo.tickets.splice(toIndex, 0, moved)
      return next
    })
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const origin = dragOriginRef.current
    dragOriginRef.current = null
    setActiveTicket(null)
    isDraggingRef.current = false
    dropTarget.release()

    const { over } = e
    if (!over || !origin) {
      setItems(columns)
      return
    }

    const located = locate(items, origin.ticketId)
    if (!located) {
      setItems(columns)
      return
    }

    const toColumnId = located.columnId
    const isCrossColumn = origin.fromColumnId !== toColumnId
    const targetCol = items.find(c => c.id === toColumnId)
    if (
      isCrossColumn &&
      (targetCol?.dropDisabled ||
        (targetCol?.allowedFromColumns && !targetCol.allowedFromColumns.includes(origin.fromColumnId)))
    ) {
      setItems(columns)
      return
    }

    let finalIndex = located.index
    let finalColumnTickets = items.find(c => c.id === toColumnId)?.tickets ?? []

    const overData = over.data.current as { columnId?: string; type?: string } | undefined
    if (overData?.type === 'ticket') {
      const overIndex = findIndexInColumn(items, toColumnId, String(over.id))
      if (overIndex >= 0 && overIndex !== located.index) {
        finalColumnTickets = arrayMove(finalColumnTickets, located.index, overIndex)
        setItems(
          items.map(c =>
            c.id !== toColumnId ? c : { ...c, tickets: finalColumnTickets },
          ),
        )
        finalIndex = overIndex
      }
    }

    if (origin.fromColumnId === toColumnId) {
      const originIndex = findIndexInColumn(columns, origin.fromColumnId, origin.ticketId)
      if (originIndex === finalIndex) return
    }

    onChange({
      ticketId: origin.ticketId,
      fromColumnId: origin.fromColumnId,
      toColumnId,
      afterTicketId: finalColumnTickets[finalIndex - 1]?.id ?? null,
      beforeTicketId: finalColumnTickets[finalIndex + 1]?.id ?? null,
    })
  }

  const handleDragCancel = () => {
    dragOriginRef.current = null
    setActiveTicket(null)
    isDraggingRef.current = false
    dropTarget.release()
    setItems(columns)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={dropTarget.detect}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className={cn('flex flex-col h-full', className)}>
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex flex-1 min-h-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((column, i) => {
            const prev = items[i - 1]
            const next = items[i + 1]
            const joinLeft = !!(column.system && prev?.system)
            const joinRight = !!(column.system && next?.system)
            const showGap = i > 0 && !joinLeft
            return (
              <Fragment key={column.id}>
                {showGap && <div aria-hidden className="w-[var(--spacing-system-mf)] shrink-0" />}
                <BoardColumn
                  column={column}
                  collapsed={!!collapsed[column.id]}
                  onToggleCollapse={collapseHandlerFor(column.id)}
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
      <DragOverlay dropAnimation={null}>
        {activeTicket ? (
          <TicketCard
            ticket={activeTicket.ticket}
            columnId={activeTicket.columnId}
            columnColor={items.find(c => c.id === activeTicket.columnId)?.color}
            isOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function locate(
  cols: BoardColumnDef[],
  ticketId: string,
): { ticket: BoardTicket; columnId: string; index: number } | null {
  for (const c of cols) {
    const idx = c.tickets.findIndex(t => t.id === ticketId)
    if (idx >= 0) return { ticket: c.tickets[idx], columnId: c.id, index: idx }
  }
  return null
}

function findIndexInColumn(cols: BoardColumnDef[], columnId: string, ticketId: string): number {
  return cols.find(c => c.id === columnId)?.tickets.findIndex(t => t.id === ticketId) ?? -1
}

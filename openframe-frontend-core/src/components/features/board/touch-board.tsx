'use client';

import { cn } from '../../../utils/cn';
import type { BoardProps } from './board';
import { BoardColumn } from './board-column';
import { useBoardCollapse } from './use-board-collapse';

/**
 * The board for touch and narrow viewports: full-height lanes in a horizontal
 * scroll-snap track, one mostly-filling the viewport with the next one peeking
 * in from the right, switched by swiping (per the tickets Figma mocks — no
 * separate column navigation is rendered).
 *
 * Nothing drag-and-drop exists in this tree at all — no monitor, no drop
 * targets, no auto-scroll, no keyboard lift (every lane renders with
 * `touchMode`, see `board-column.tsx`). The HTML5 drag events Pragmatic builds
 * on never fire under touch, so a drag here could only ever be a dead
 * affordance. A card's column is changed from the ticket itself (its dialog),
 * not from the board, which is why this component never calls `onChange`.
 *
 * Collapse works exactly as on the drag board (same lane header buttons, same
 * `collapseStorageKey`, so the choice survives a mode switch); a collapsed lane
 * is a narrow vertical stop in the same snap track. Only the custom horizontal
 * scrollbar is absent — in a snap pager the track itself is the navigation.
 */
export function TouchBoard({
  columns,
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
  const { collapsed, toggle } = useBoardCollapse(collapseStorageKey);

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div
        // `snap-start`, not `snap-center`: the mocks left-align the current
        // lane with the page padding and let the next one peek in at the right.
        className="flex min-h-0 flex-1 snap-x snap-mandatory gap-[var(--spacing-system-mf)] overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {columns.map(column => (
          <BoardColumn
            key={column.id}
            column={column}
            touchMode
            collapsed={!!collapsed[column.id]}
            onToggleCollapse={toggle}
            // The peek IS the column navigation: capped under the track width by
            // one gutter more than the gap, so the next lane is always visible.
            // A collapsed lane keeps the lane's own `w-14` strip.
            className={cn(
              'snap-start',
              !collapsed[column.id] && 'w-[min(400px,calc(100%_-_2*var(--spacing-system-mf)))]',
            )}
            onAddTicket={onAddTicket}
            onArchive={onArchiveColumn}
            getTicketHref={getTicketHref}
            renderAssignSlot={renderAssignSlot}
            onApprove={onApprove}
            onReject={onReject}
            onLoadMore={onLoadMore}
            loadMoreRootMargin={loadMoreRootMargin}
          />
        ))}
      </div>
    </div>
  );
}

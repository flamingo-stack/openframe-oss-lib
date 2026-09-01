'use client';

import type { ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import { SortableList } from '../sortable-list/sortable-list';
import { SortableMoveButtons } from '../sortable-list/sortable-move-buttons';
import { type SortableDragHandleProps, useSortableItem } from '../sortable-list/use-sortable-item';

export interface SortableRowRenderArgs {
  /** Spread onto the grip whole — it carries the ref and the keyboard path. */
  dragHandleProps: SortableDragHandleProps;
  isDragging: boolean;
  /**
   * The touch replacement for the grip: an up/down `SortableMoveButtons` pair,
   * non-null exactly when drag is unavailable (touch/narrow viewports). Render
   * it where the row's reorder control belongs — and no grip beside it.
   */
  moveButtons: ReactNode | null;
}

export interface TicketStatusConfigListProps<T extends { id: string }> {
  items: T[];
  onReorder: (oldIndex: number, newIndex: number) => void;
  renderRow: (item: T, args: SortableRowRenderArgs) => ReactNode;
  /** Names a row for the live region and the move buttons, e.g. its status name. */
  getItemLabel?: (index: number) => string | undefined;
  className?: string;
}

/**
 * A reorderable list of config rows (ticket statuses, AI quick actions), built
 * on {@link SortableList} — Pragmatic drag and drop on desktop, an explicit
 * up/down pair on touch, where the HTML5 drag events never fire.
 *
 * `id` keys React rows only; the reorder itself is DOM-order based, so
 * duplicates in `items` cannot collide.
 */
export function TicketStatusConfigList<T extends { id: string }>({
  items,
  onReorder,
  renderRow,
  getItemLabel,
  className,
}: TicketStatusConfigListProps<T>) {
  return (
    <SortableList
      onReorder={onReorder}
      getItemLabel={getItemLabel}
      className={cn('flex w-full flex-col gap-[var(--spacing-system-xs)]', className)}
    >
      {items.map((item, index) => (
        <SortableRow key={item.id} index={index} count={items.length} label={getItemLabel?.(index)}>
          {args => renderRow(item, args)}
        </SortableRow>
      ))}
    </SortableList>
  );
}

function SortableRow({
  index,
  count,
  label,
  children,
}: {
  index: number;
  count: number;
  label?: string;
  children: (args: SortableRowRenderArgs) => ReactNode;
}) {
  const { itemRef, dragHandleProps, isDragging, dragAndDropEnabled } = useSortableItem();

  return (
    <div
      ref={itemRef}
      // Raise the actively dragged row above its siblings — without this the
      // stacking follows DOM order, so a row dragged DOWN slides UNDER the rows
      // below it while a row dragged up correctly renders on top.
      className={isDragging ? 'relative z-10' : undefined}
    >
      {children({
        dragHandleProps,
        isDragging,
        moveButtons: dragAndDropEnabled ? null : <SortableMoveButtons index={index} count={count} label={label} />,
      })}
    </div>
  );
}

'use client';

import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { disableNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/disable-native-drag-preview';
import { type KeyboardEvent, useCallback, useEffect, useState } from 'react';
import { holdMoveDragEffect } from '../../../utils/drag-effect';
import { SORTABLE_ITEM_ATTRIBUTE, useSortableListContext } from './sortable-list';

export interface SortableItem {
  /** Goes on the item's root element — the thing that moves. */
  itemRef: (node: HTMLElement | null) => void;
  /**
   * Goes on the grip. Only the grip starts a drag, so text selection and normal
   * clicking inside the item keep working, and it carries the keyboard
   * alternative — so spread it rather than picking it apart.
   */
  dragHandleProps: SortableDragHandleProps;
  isDragging: boolean;
  /**
   * The input-type gate: `false` on touch/narrow viewports (and during SSR).
   * When `false` the item registers no drag at all — render explicit move
   * controls (`SortableMoveButtons`) instead of the drag handle.
   */
  dragAndDropEnabled: boolean;
}

/** What `dragHandleProps` carries — spread it onto the grip, don't pick it apart. */
export interface SortableDragHandleProps {
  // Callback refs, not `Ref<HTMLElement>`: a ref OBJECT of the wider type
  // cannot be attached to a `<button>` or a `<div>`, a callback taking the
  // wider type can.
  ref: (node: HTMLElement | null) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

/**
 * Registers one item of a {@link SortableList}.
 *
 * The item's own element is the draggable, and the list finds it by the marker
 * this hook sets — so nothing about a row's identity has to survive a round trip
 * through the DOM, and there is no per-item id to mismatch during hydration.
 *
 * Pragmatic drag and drop deliberately ships no keyboard dragging, so the grip
 * carries its own: Arrow Up / Arrow Down move the item one place. One press, one
 * move — no lift-and-place mode to get stuck in, and it works identically for
 * screen-reader users, who hear the result from the list's live region.
 */
export function useSortableItem(): SortableItem {
  const { dragType, disabled, dragAndDropEnabled, reorder, readItems } = useSortableListContext();
  // Both stop the drag registration and the keyboard path; only the consumer's
  // `disabled` also stops the move buttons, which are the touch replacement.
  const inert = disabled || !dragAndDropEnabled;
  // State rather than refs: registration has to wait until the consumer has
  // actually rendered its grip, and only a re-render tells us it did.
  const [item, setItem] = useState<HTMLElement | null>(null);
  const [handle, setHandle] = useState<HTMLElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const itemRef = useCallback((node: HTMLElement | null) => {
    // Set here rather than rendered as a prop: it is this module's private
    // bookkeeping, and a consumer forgetting to spread it would break the list
    // silently.
    node?.setAttribute(SORTABLE_ITEM_ATTRIBUTE, '');
    setItem(node);
  }, []);

  useEffect(() => {
    if (!item || !handle || inert) return undefined;
    return combine(
      // The drag has to start as a "move", or its first frame is drawn with the
      // copy cursor — see `drag-effect.ts`.
      holdMoveDragEffect(item),
      draggable({
        element: item,
        dragHandle: handle,
        getInitialData: () => ({ type: dragType }),
        // The list moves the real item instead — see `SortableList`.
        onGenerateDragPreview: ({ nativeSetDragImage }) => disableNativeDragPreview({ nativeSetDragImage }),
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
      }),
    );
  }, [item, handle, inert, dragType]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
      if (!step || inert) return;
      const items = readItems();
      const from = items.indexOf(event.currentTarget.closest(`[${SORTABLE_ITEM_ATTRIBUTE}]`) as HTMLElement);
      const to = from + step;
      if (from < 0 || to < 0 || to >= items.length) return;
      event.preventDefault();
      reorder(from, to);
      // The grip is re-rendered at its new position; keep the focus on it so a
      // run of presses keeps moving the same item.
      requestAnimationFrame(() => handle?.focus());
    },
    [inert, readItems, reorder, handle],
  );

  return { itemRef, dragHandleProps: { ref: setHandle, onKeyDown }, isDragging, dragAndDropEnabled };
}

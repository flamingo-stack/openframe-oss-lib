'use client';

import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { dropTargetForElements, monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { preventUnhandled } from '@atlaskit/pragmatic-drag-and-drop/utils/prevent-unhandled';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useDragAndDropEnabled } from '../../../hooks/ui/use-drag-and-drop-enabled';
import { useIsomorphicLayoutEffect } from '../../../hooks/ui/use-isomorphic-layout-effect';
import { autoScrollAncestors, autoScrollBothWays } from '../../../utils/auto-scroll-ancestors';
import { type DragSlots, measureSlots, resolveSlot, shiftFor } from './slot-geometry';

/** Marks the elements the list reorders. Set by `useSortableItem`, never by hand. */
export const SORTABLE_ITEM_ATTRIBUTE = 'data-sortable-item';

/** How long a displaced item takes to slide into the slot it is giving up. */
const SHIFT_MS = 200;
/** How long the dropped item takes to travel from the pointer into its slot. */
const DROP_MS = 150;
const EASING = 'cubic-bezier(0.2, 0, 0, 1)';

interface SortableListContextValue {
  /** Distinguishes this list's drags from any other list's on the page. */
  dragType: string;
  /** The consumer's `disabled` prop: everything off, move buttons included. */
  disabled: boolean;
  /**
   * The input-type gate (`useDragAndDropEnabled`): `false` on touch/narrow
   * viewports, where no drag is registered and rows render explicit
   * `SortableMoveButtons` instead of a handle.
   */
  dragAndDropEnabled: boolean;
  /** Reorders the list. Used by the drop, a handle's arrow keys AND the move buttons. */
  reorder: (from: number, to: number) => void;
  /** Every registered item, in DOM order. */
  readItems: () => HTMLElement[];
}

const SortableListContext = createContext<SortableListContextValue | null>(null);

export function useSortableListContext(): SortableListContextValue {
  const context = useContext(SortableListContext);
  if (!context) throw new Error('useSortableItem must be used inside a <SortableList>');
  return context;
}

export interface SortableListProps {
  /** Called once, on drop or on an arrow key — never mid-drag. */
  onReorder: (from: number, to: number) => void;
  /**
   * Names an item for the live region, e.g. `index => scripts[index].name`.
   * Without it a move is announced as "Item moved to position 2 of 5".
   */
  getItemLabel?: (index: number) => string | undefined;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * A vertical list whose items can be reordered by dragging a handle.
 *
 * **The drag moves nothing but transforms.** The item being dragged keeps its
 * slot and is translated to follow the pointer; the items it passes are
 * translated by exactly its height plus the row gap, into the slot it vacated.
 * The list's layout — and so the height of the page around it — is therefore
 * identical from the first frame of the drag to the last, which is what makes
 * the slide safe to animate. Opening and closing real space instead (margins,
 * `display: none`) cannot be: interrupt one of those transitions by moving the
 * pointer, or reorder the DOM on drop, and the two ends run at different rates
 * and the page jumps.
 *
 * The native drag image is switched off — the browser draws it washed out and
 * offers no way to style it — so what follows the pointer is the real item, at
 * full opacity, styled by the consumer off `isDragging`.
 *
 * Deliberately NOT what the ticket board does: a board moves cards between
 * columns and its cards are drop targets in their own right. Here the answer is
 * geometry over a single column, which is why it fits in one small module. The
 * rules it sorts by live in `slot-geometry.ts`.
 */
export function SortableList({ onReorder, getItemLabel, disabled = false, className, children }: SortableListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  // False on touch/narrow viewports: no drag is initialized anywhere in the
  // list, and rows fall back to explicit move buttons.
  const dragAndDropEnabled = useDragAndDropEnabled();
  // Stable across renders and never rendered, so there is no hydration to
  // mismatch — unlike keying a drag on a random per-item id.
  const dragType = useId();
  const [announcement, setAnnouncement] = useState('');

  // Refreshed in an unconditional effect rather than in the render body: both
  // are read only from a drag or keyboard-move handler, which cannot run
  // before a commit, and a render attempt React discards must not be able to
  // leave a reorder callback behind that never took effect.
  const onReorderRef = useRef(onReorder);
  const getItemLabelRef = useRef(getItemLabel);
  useEffect(() => {
    onReorderRef.current = onReorder;
    getItemLabelRef.current = getItemLabel;
  });

  // Where every item sat on screen the instant the drop happened — the "First"
  // of the FLIP played once the reorder has committed. A LOOKUP TABLE keyed by
  // element, not a list to iterate: the "Last" is measured on the items the
  // list actually has after the reorder commit (re-queried from the DOM), and
  // this only answers "where was this one?". An item the reorder removed is
  // therefore skipped instead of being styled as a detached node.
  const flipFrom = useRef<Map<HTMLElement, number> | null>(null);
  const [flipTick, setFlipTick] = useState(0);
  const flipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const readItems = useCallback(
    () => [...(listRef.current?.querySelectorAll<HTMLElement>(`[${SORTABLE_ITEM_ATTRIBUTE}]`) ?? [])],
    [],
  );

  /** The one way this list ever changes: say what happened, then do it. */
  const reorder = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      const label = getItemLabelRef.current?.(from) ?? 'Item';
      setAnnouncement(`${label} moved to position ${to + 1} of ${readItems().length}.`);
      onReorderRef.current(from, to);
    },
    [readItems],
  );

  useEffect(() => {
    const list = listRef.current;
    if (!list || disabled || !dragAndDropEnabled) return undefined;

    /** Alive for one drag; this effect body is its whole scope. */
    let drag: (DragSlots & { items: HTMLElement[]; to: number; startY: number }) | null = null;

    return combine(
      // Dragging towards the edge of the screen — or past it — scrolls whatever
      // actually scrolls there: the page, the layout's `<main>`, or the list
      // itself when it has its own overflow.
      autoScrollAncestors(list),
      autoScrollBothWays(list),
      // One target for the whole list: which slot a drop lands in is answered by
      // geometry, so this only has to say "inside the list, or outside it".
      dropTargetForElements({
        element: list,
        canDrop: ({ source }) => source.data.type === dragType,
      }),
      monitorForElements({
        canMonitor: ({ source }) => source.data.type === dragType,

        onDragStart: ({ source, location }) => {
          // Only the list is a drop target, so a drag carried anywhere else on
          // the page has none — and a native drag with no target under it falls
          // back to the browser's own drop effect, which is `copy` and draws the
          // green plus cursor. This holds it at `move` for the whole drag.
          preventUnhandled.start();
          const items = readItems();
          const from = items.indexOf(source.element);
          if (from < 0) return;
          const gap = Number.parseFloat(getComputedStyle(list).rowGap) || 0;
          // The list's own top is the frame of reference for the whole drag, so
          // that auto-scrolling under the pointer changes nothing but the origin.
          const origin = list.getBoundingClientRect().top;
          drag = {
            ...measureSlots(items, from, gap, origin),
            items,
            to: from,
            startY: location.current.input.clientY - origin,
          };
        },

        onDrag: ({ location }) => {
          const current = drag;
          if (!current) return;
          // Re-read the origin every frame: auto-scroll moves the list under a
          // pointer that has not moved, and the item has to keep up with it.
          const offset = location.current.input.clientY - list.getBoundingClientRect().top - current.startY;

          // Vertical only, the way `restrictToVerticalAxis` pinned it, and with
          // no transition: this one tracks the pointer exactly.
          const dragged = current.items[current.from];
          dragged.style.transition = 'none';
          dragged.style.transform = `translateY(${offset}px)`;

          const to = resolveSlot(current, current.to, offset);
          // Re-applying an unchanged shift would restart its transition every
          // frame, so the items would creep instead of sliding.
          if (to === current.to) return;
          current.to = to;

          for (const [index, item] of current.items.entries()) {
            if (index === current.from) continue;
            const shift = shiftFor(current, index, to);
            item.style.transition = `transform ${SHIFT_MS}ms ${EASING}`;
            item.style.transform = shift ? `translateY(${shift}px)` : '';
          }
        },

        onDrop: ({ location }) => {
          preventUnhandled.stop();
          const finished = drag;
          drag = null;
          if (!finished) return;

          // Read where everything IS, transforms and all, before letting go of
          // them — this is what the drop animation plays back from.
          flipFrom.current = new Map(finished.items.map(item => [item, item.getBoundingClientRect().top]));
          if (flipTimer.current) clearTimeout(flipTimer.current);
          for (const item of finished.items) {
            item.style.transition = 'none';
            item.style.transform = '';
          }

          // Empty means released outside the list, or cancelled with Escape —
          // the item still has to travel back to its own slot, so the animation
          // is scheduled either way.
          const cancelled = location.current.dropTargets.length === 0;
          setFlipTick(tick => tick + 1);
          if (!cancelled) reorder(finished.from, finished.to);
        },
      }),
    );
  }, [dragType, disabled, dragAndDropEnabled, readItems, reorder]);

  // Runs after the commit that carries BOTH the reorder and the tick above, so
  // the DOM is already in its final order — which is why `onReorder` never has
  // to wait for an animation. Every item that ended up somewhere other than
  // where it looked is put back there and released; the items that stood aside
  // during the drag are already in place and come out with a delta of zero, so
  // this animates the dropped item and nothing else.
  useIsomorphicLayoutEffect(() => {
    const from = flipFrom.current;
    flipFrom.current = null;
    if (!from) return;

    const moving: HTMLElement[] = [];
    // The "Last" is measured on the list as it stands NOW — re-queried, not
    // replayed from the pre-drop capture, so an item the reorder dropped is
    // simply absent instead of being animated as a node no longer in the tree.
    for (const item of readItems()) {
      const top = from.get(item);
      if (top === undefined) continue;
      const delta = top - item.getBoundingClientRect().top;
      if (!delta) continue;
      item.style.transition = 'none';
      item.style.transform = `translateY(${delta}px)`;
      moving.push(item);
    }
    if (moving.length === 0) return;

    // One forced reflow, so the browser takes the inverted position as the
    // animation's starting point instead of coalescing it away unseen.
    void listRef.current?.offsetHeight;

    for (const item of moving) {
      item.style.transition = `transform ${DROP_MS}ms ${EASING}`;
      item.style.transform = '';
    }
    flipTimer.current = setTimeout(() => {
      for (const item of moving) item.style.transition = '';
    }, DROP_MS);
  }, [flipTick, readItems]);

  useEffect(
    () => () => {
      if (flipTimer.current) clearTimeout(flipTimer.current);
    },
    [],
  );

  const context = useMemo<SortableListContextValue>(
    () => ({ dragType, disabled, dragAndDropEnabled, reorder, readItems }),
    [dragType, disabled, dragAndDropEnabled, reorder, readItems],
  );

  return (
    <SortableListContext.Provider value={context}>
      <div ref={listRef} className={className}>
        {children}
        {/* Absolutely positioned, so it is not a flex item and adds no gap. */}
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </div>
    </SortableListContext.Provider>
  );
}

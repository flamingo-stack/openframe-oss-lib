'use client';

import type { FC, ReactNode, RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useIsomorphicLayoutEffect } from '../../hooks/ui/use-isomorphic-layout-effect';
import { cn } from '../../utils/cn';
import { CheckboxCheckmarkIcon } from '../icons-v2-generated/signs-and-symbols/checkbox-checkmark-icon';
import { Button } from '../ui';
import { useCollisionBoundary, usePortalContainer } from '../ui/portal-container';

// Types for filter configuration
export interface FilterOption {
  id: string;
  label: string;
  value: string | number | boolean;
  count?: number;
  type?: 'option' | 'separator';
}

export interface FilterSection {
  id: string;
  title: string;
  type: 'checkbox' | 'radio' | 'select';
  options: FilterOption[];
  allowSelectAll?: boolean;
  defaultSelected?: string[];
}

export interface FiltersDropdownProps {
  triggerElement?: ReactNode; // Custom trigger element
  triggerLabel?: string; // Label for default trigger button
  sections: FilterSection[];
  onApply: (filters: Record<string, string[]>) => void;
  onReset?: () => void;
  className?: string;
  dropdownClassName?: string;
  /**
   * Currently applied filters to preserve state when reopening.
   * Pass the same filters that were applied via onApply callback.
   *
   * @example
   * ```tsx
   * const { appliedFilters, handleApply } = useFiltersDropdown(sections)
   *
   * <FiltersDropdown
   *   sections={sections}
   *   onApply={handleApply}
   *   currentFilters={appliedFilters}
   *   triggerLabel="STATUS"
   * />
   * ```
   */
  currentFilters?: Record<string, string[]>;
  placement?: 'bottom-start' | 'bottom-end' | 'bottom';
  /**
   * Enable responsive mobile behavior (full width on mobile)
   * @default true
   */
  responsive?: boolean;
  /**
   * Draw the panel in a portal, `fixed` under the trigger, instead of `absolute` inside this component's box. For a
   * trigger that sits in a clipping box (a grid table's header is its own `overflow: hidden` viewport), where an
   * in-flow panel would be cut off. The panel follows the trigger while the page or the table scrolls.
   * @default false
   */
  floating?: boolean;
}

// Custom checkbox component
const FilterCheckbox: FC<{
  checked: boolean;
  disabled?: boolean;
  className?: string;
}> = ({ checked, disabled = false, className }) => {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      className={cn(
        'relative h-6 w-6 shrink-0 rounded-[6px] transition-all duration-150',
        checked ? 'bg-ods-accent' : 'bg-ods-bg-surface',
        !checked && 'border-2 border-ods-border',
        disabled && 'opacity-50',
        className,
      )}
    >
      {checked && (
        <div className="absolute inset-0 flex items-center justify-center text-ods-text-on-accent">
          <CheckboxCheckmarkIcon size={10} />
        </div>
      )}
    </div>
  );
};

/** A floating panel's distance from its trigger and from the edges of the room it has, in px. */
const FLOATING_GAP = 8;
const FLOATING_WIDTH = 320;
/** The option list's own height limit: keep in step with its `max-h-[250px]` below. */
const FLOATING_LIST_MAX_HEIGHT = 250;

/** Which side of its trigger a floating panel opens on. */
type FloatingSide = 'below' | 'above';

/**
 * How tall a floating panel wants to be, and the least it can be while still useful: Reset / Apply and one row.
 *
 * Read from the content, not from the panel's current box: once a cap is set the box is the cap, and a height measured
 * there would keep the cap after the window grows. The option list's scrollHeight is its whole content whatever its
 * box; the rest of the card (padding, the buttons) does not change with the cap. `offsetHeight`, not
 * `getBoundingClientRect`: the panel opens at `scale-95`, and a transformed rect is 5% short.
 */
function floatingPanelSize(card: HTMLElement | null): { natural: number; minimum: number } {
  if (!card) return { natural: 0, minimum: 0 };
  const list = card.querySelector<HTMLElement>('[data-filter-panel="list"]');
  if (!list) return { natural: card.offsetHeight, minimum: card.offsetHeight };
  const chrome = card.offsetHeight - list.offsetHeight;
  const listNatural = Math.min(list.scrollHeight, FLOATING_LIST_MAX_HEIGHT);
  const header = list.querySelector<HTMLElement>('[data-filter-panel="section-header"]');
  const option = list.querySelector<HTMLElement>('[data-filter-panel="option"]');
  const oneRow = (header?.offsetHeight ?? 0) + (option?.offsetHeight ?? 0);
  return { natural: chrome + listNatural, minimum: chrome + Math.min(listNatural, oneRow) };
}

/**
 * The vertical room a floating panel has: the collision boundary's (a chat panel the overlay must stay inside) when
 * one is set, within the window. The same source Radix overlays flip against.
 */
function floatingVerticalBounds(boundary: HTMLElement | null): { top: number; bottom: number } {
  if (!boundary) return { top: 0, bottom: window.innerHeight };
  const rect = boundary.getBoundingClientRect();
  return { top: Math.max(0, rect.top), bottom: Math.min(window.innerHeight, rect.bottom) };
}

/** Where a floating panel goes: inline styles for the panel (`left`, `top`, `bottom`) and its card (`maxHeight`). */
interface FloatingLayout {
  side: FloatingSide;
  /** Its header is out of the box its table shows (scrolled out sideways, or left only under a pinned column). */
  detached: boolean;
  left: string;
  top: string;
  bottom: string;
  maxHeight: string;
}

/**
 * Where a floating panel (`fixed`, in a portal) goes at its trigger.
 *
 * Horizontally: hung from the edge its placement names, kept inside the box its table shows (see
 * `floatingHorizontalRoom`), so a column scrolled partly out of a narrow table keeps its panel by the table, not at
 * the window's edge over whatever stands beside it. Vertically: below its trigger when it
 * fits there; otherwise on the side with more room, and capped to that room when neither side holds all of it (the
 * option list shrinks and scrolls, Reset / Apply stay on screen). A panel that opened above is placed by `bottom`, so
 * a change in its height never opens a gap between it and its trigger.
 *
 * `held` is the side the open panel is on: it keeps it while that side still holds Reset / Apply and a row, so a page
 * scrolled near the threshold does not throw the panel across its trigger. `null` chooses afresh (opening).
 */
function floatingPanelLayout(
  panel: HTMLElement,
  card: HTMLElement | null,
  trigger: Element | null,
  placement: 'bottom-start' | 'bottom-end' | 'bottom',
  boundary: HTMLElement | null,
  held: FloatingSide | null,
): FloatingLayout | null {
  if (!trigger) return null;
  const rect = trigger.getBoundingClientRect();
  const width = panel.offsetWidth || FLOATING_WIDTH;
  const wanted =
    placement === 'bottom-end'
      ? rect.right - width
      : placement === 'bottom'
        ? (rect.left + rect.right) / 2 - width / 2
        : rect.left;
  const sideways = floatingHorizontalRoom(trigger, boundary);
  // A room narrower than the panel: the panel starts at its left edge and runs past the right one.
  const min = sideways.left + FLOATING_GAP;
  const max = Math.max(min, sideways.right - width - FLOATING_GAP);

  const size = floatingPanelSize(card);
  const bounds = floatingVerticalBounds(boundary);
  const roomBelow = bounds.bottom - FLOATING_GAP - (rect.bottom + FLOATING_GAP);
  const roomAbove = rect.top - FLOATING_GAP - (bounds.top + FLOATING_GAP);

  let side: FloatingSide;
  if (held === null) {
    side = size.natural <= roomBelow || roomBelow >= roomAbove ? 'below' : 'above';
  } else {
    const room = held === 'below' ? roomBelow : roomAbove;
    const other = held === 'below' ? roomAbove : roomBelow;
    side = room < size.minimum && other > room ? (held === 'below' ? 'above' : 'below') : held;
  }
  const room = side === 'below' ? roomBelow : roomAbove;

  return {
    side,
    detached: sideways.headerVisible <= 0,
    left: `${Math.min(Math.max(wanted, min), max)}px`,
    top: side === 'below' ? `${rect.bottom + FLOATING_GAP}px` : '',
    bottom: side === 'above' ? `${window.innerHeight - rect.top + FLOATING_GAP}px` : '',
    maxHeight: size.natural > room ? `${Math.max(room, 0)}px` : '',
  };
}

/**
 * The horizontal room an `absolute` panel has: inside every ancestor that clips its overflow (a page's scrolling
 * column, a card with `overflow-hidden`), within the window. A panel measured against the window alone fits there and is still
 * cut off by its column, or slides under whatever stands beside it (a side panel, a navigation rail).
 */
const CLIPPING_OVERFLOW = new Set(['hidden', 'clip', 'auto', 'scroll', 'overlay']);

/** The ancestors of `element` that clip their overflow sideways, innermost first, below `<body>`. */
function clippingAncestors(element: Element): HTMLElement[] {
  const found: HTMLElement[] = [];
  for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
    if (CLIPPING_OVERFLOW.has(window.getComputedStyle(node).overflowX)) found.push(node);
  }
  return found;
}

function horizontalBounds(element: Element): { left: number; right: number } {
  let left = 0;
  let right = window.innerWidth;
  // Every clipping ancestor cuts the panel, so the room is what is left inside all of them.
  for (const node of clippingAncestors(element)) {
    const rect = node.getBoundingClientRect();
    left = Math.max(left, rect.left);
    right = Math.min(right, rect.right);
  }
  return { left, right };
}

/** The pinned blocks' widths a grid table publishes on its root (`--dt-pin-l` / `--dt-pin-r`), 0 when unset. */
function pinnedInsets(cell: Element): { left: number; right: number } {
  const style = window.getComputedStyle(cell);
  return {
    left: Number.parseFloat(style.getPropertyValue('--dt-pin-l')) || 0,
    right: Number.parseFloat(style.getPropertyValue('--dt-pin-r')) || 0,
  };
}

/**
 * The horizontal room a floating panel (`fixed`, in a portal) has, and how much of its header shows in it.
 *
 * The room is the box the trigger's table shows: every clipping ancestor ABOVE the trigger's own header cell
 * (`data-grid-header-cell`), within the collision boundary when one is set, else the window. The cell is skipped by
 * identity, not by size: it clips its own label, and a grown or resized column can be as wide as the panel. The panel
 * is not clipped by any of them (it is portalled), but placed outside that box it reads as belonging to whatever stands
 * beside the table (the navigation rail, the chat).
 *
 * The grid's pinned blocks cover the scroll box's edges, so a header under them is out of view though inside the box:
 * the innermost box is inset by their widths, unless the trigger's cell is pinned itself.
 *
 * `headerVisible` is the trigger's width in view (cell and room); 0 or less is a header scrolled out. A trigger with no
 * size has not been laid out (a hidden tab, a panel still animating in): it reports as visible, never as scrolled out.
 */
function floatingHorizontalRoom(
  trigger: Element,
  boundary: HTMLElement | null,
): { left: number; right: number; headerVisible: number } {
  const cell = trigger.closest('[data-grid-header-cell]');
  let left = 0;
  let right = window.innerWidth;
  if (boundary) {
    const rect = boundary.getBoundingClientRect();
    left = Math.max(left, rect.left);
    right = Math.min(right, rect.right);
  }
  const insets = cell && window.getComputedStyle(cell).position !== 'sticky' ? pinnedInsets(cell) : null;
  clippingAncestors(cell ?? trigger).forEach((node, index) => {
    const rect = node.getBoundingClientRect();
    const inset = index === 0 && insets ? insets : { left: 0, right: 0 };
    left = Math.max(left, rect.left + inset.left);
    right = Math.min(right, rect.right - inset.right);
  });

  const header = trigger.getBoundingClientRect();
  if (header.width === 0 && header.height === 0) return { left, right, headerVisible: Number.POSITIVE_INFINITY };
  const shown = cell ? cell.getBoundingClientRect() : header;
  const headerVisible = Math.min(header.right, shown.right, right) - Math.max(header.left, shown.left, left);
  return { left, right, headerVisible };
}

// Animation timings (ms). Must stay in sync with the `duration-200` Tailwind
// class on the dropdown panel below.
const ANIMATION_MS = 200;

export const FiltersDropdown: FC<FiltersDropdownProps> = ({
  triggerElement,
  triggerLabel = 'Filters',
  sections,
  onApply,
  onReset,
  className,
  dropdownClassName,
  currentFilters,
  placement = 'bottom-start',
  responsive = true,
  floating = false,
}) => {
  const portalContainer = usePortalContainer();
  const collisionBoundary = useCollisionBoundary();
  const [isOpen, setIsOpen] = useState(false);
  // `shouldRender` controls mount/unmount.
  // `isVisible` controls the open/closed *visual* state and drives the CSS transition.
  // Splitting them lets us mount in the closed visual state, then flip to open on
  // the next frame so the browser actually transitions (instead of teleporting).
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [measuredMobile, setIsMobile] = useState(false);
  const [actualPlacement, setActualPlacement] = useState(placement);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // The side a floating panel opened on. State for the classes that follow it (the animation's origin and direction),
  // a ref for the placement code, which runs outside render (the layout effect, the scroll and resize handler).
  const [floatingSide, setFloatingSide] = useState<FloatingSide | null>(null);
  const floatingSideRef = useRef<FloatingSide | null>(null);

  // Drive mount/unmount and visual state from `isOpen`.
  //
  // Open  : mount with closed styles → wait two frames, flip to visible → CSS transition runs.
  // Close : flip to invisible → CSS transition runs → unmount after duration.
  //
  // Because we use CSS transitions (not @keyframes), interrupting mid-animation
  // smoothly continues from the current computed value — no flicker.
  // The two INSTANT halves are adjusted while rendering: mounting on open and
  // dropping the visible class on close are both edges the render already knows
  // about, and doing them here rather than from the effect removes a render
  // pass from every open and every close. Each is guarded on the state it
  // writes, so the pass React schedules for the adjustment takes the early exit.
  // The effect below is left owning only the two halves that genuinely need a
  // timer: the double-rAF entry and the delayed unmount.
  if (isOpen && !shouldRender) setShouldRender(true);
  if (!isOpen && isVisible) setIsVisible(false);
  // Unmounted: the next open chooses its side afresh. Not on close — the panel is still on screen for its exit.
  if (!shouldRender && floatingSide !== null) setFloatingSide(null);

  useEffect(() => {
    if (isOpen) {
      // Double rAF: the first frame guarantees the element is mounted and the
      // closed styles have been painted; the second flips to the open state so
      // the browser sees a transitionable property change. A single rAF can
      // sometimes fire in the same frame as mount, suppressing the transition.
      let id2 = 0;
      const id1 = requestAnimationFrame(() => {
        id2 = requestAnimationFrame(() => setIsVisible(true));
      });
      return () => {
        cancelAnimationFrame(id1);
        cancelAnimationFrame(id2);
      };
    }
    const t = setTimeout(() => setShouldRender(false), ANIMATION_MS);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Check if mobile on mount and resize. `responsive: false` means "never treat
  // this as mobile" — a fact about the PROP, so it masks the measurement below
  // instead of being written into it from the effect.
  const isMobile = responsive && measuredMobile;

  useEffect(() => {
    if (!responsive) return undefined;

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [responsive]);

  useEffect(() => {
    if (!isOpen || isMobile || !triggerRef.current) return undefined;

    const calculateOptimalPlacement = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const triggerRect = trigger.getBoundingClientRect();
      const dropdownWidth = 320; // Fixed width from the dropdown
      // The room the panel has is its clipping container's, not the window's: see `horizontalBounds`.
      const bounds = horizontalBounds(trigger);

      // The panel hangs off ONE edge of the trigger — its left for `bottom-start`,
      // its right for `bottom-end` — so what has to fit is the panel's own width
      // from that edge, not the room beyond the trigger's far side. A trigger as
      // wide as its column (a table's filter header, `w-full` of a `flex-1`
      // cell) would otherwise report no room past its right edge while the
      // panel, hung from its left, has the whole column to itself — and flip to
      // the far end of the row, away from the label it belongs to.
      const fitsFromLeft = triggerRect.left + dropdownWidth <= bounds.right;
      const fitsFromRight = triggerRect.right - dropdownWidth >= bounds.left;
      const center = (triggerRect.left + triggerRect.right) / 2;
      const fitsCentered = center - dropdownWidth / 2 >= bounds.left && center + dropdownWidth / 2 <= bounds.right;

      let optimalPlacement = placement;

      if (placement === 'bottom-start' && !fitsFromLeft && fitsFromRight) {
        optimalPlacement = 'bottom-end';
      } else if (placement === 'bottom-end' && !fitsFromRight && fitsFromLeft) {
        optimalPlacement = 'bottom-start';
      } else if (placement === 'bottom' && !fitsCentered) {
        optimalPlacement = !fitsFromLeft && fitsFromRight ? 'bottom-end' : 'bottom-start';
      }

      setActualPlacement(optimalPlacement);
    };

    calculateOptimalPlacement();
    window.addEventListener('resize', calculateOptimalPlacement);

    return () => window.removeEventListener('resize', calculateOptimalPlacement);
  }, [isOpen, isMobile, placement]);

  // A `fixed` panel — floating, or any panel on mobile — is placed from a live
  // measurement of where the trigger currently sits. Applied to the node in a
  // layout effect rather than read during render — `getBoundingClientRect()`
  // in the render body measured the PREVIOUS commit's layout, so the panel
  // opened against a trigger position that could already be wrong (page
  // scrolled between renders, chips above the trigger wrapping to a second
  // line) and had no way to correct itself. Unconditional so every commit
  // re-measures; runs before paint, so the panel never appears in the wrong
  // place first.
  useIsomorphicLayoutEffect(() => {
    const dropdown = dropdownRef.current;
    if (!dropdown) {
      floatingSideRef.current = null;
      return;
    }
    if (isMobile || floating) {
      // On the side it opened on, fitted to the room there (see `floatingPanelLayout`). The mobile panel's width and
      // side margins are its classes (`left-4 right-4`), so only the vertical place is written for it.
      const card = cardRef.current;
      const layout = floatingPanelLayout(
        dropdown,
        card,
        triggerRef.current,
        placement,
        collisionBoundary,
        floatingSideRef.current,
      );
      if (layout) {
        dropdown.style.left = isMobile ? '' : layout.left;
        dropdown.style.top = layout.top;
        dropdown.style.bottom = layout.bottom;
        if (card) card.style.maxHeight = layout.maxHeight;
        floatingSideRef.current = layout.side;
        if (layout.side !== floatingSide) setFloatingSide(layout.side);
        // Its header scrolled out of the table: the panel would filter a column nobody can see. Closed like Escape;
        // the unapplied picks stay for the next open. The mobile panel spans the screen, so it stays.
        if (floating && !isMobile && layout.detached) setIsOpen(false);
      }
      return;
    }
    // Desktop, not floating: `absolute` + placement classes — an inline place or
    // cap left from a mobile or floating layout would fight them.
    dropdown.style.top = '';
    dropdown.style.bottom = '';
    dropdown.style.left = '';
    if (cardRef.current) cardRef.current.style.maxHeight = '';
  });

  // Initialize state with current filters or defaults
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>(() => {
    if (currentFilters) {
      return { ...currentFilters };
    }
    const initial: Record<string, string[]> = {};
    sections.forEach(section => {
      initial[section.id] = section.defaultSelected || [];
    });
    return initial;
  });

  // Sync with external changes to currentFilters. Keyed on the serialised
  // CONTENT, not the object identity — a parent that rebuilds the same filters
  // object every render must not stomp local state. Read back from the same
  // string so the effect has no stale-closure gap.
  // Adjusted while rendering — React's documented prop-sync pattern — rather
  // than from an effect: the checkboxes render from `selectedFilters`, so an
  // externally applied filter set arrived one frame after the panel had already
  // painted the previous selection.
  const currentFiltersStr = currentFilters ? JSON.stringify(currentFilters) : '';
  const [syncedFiltersStr, setSyncedFiltersStr] = useState(currentFiltersStr);
  if (syncedFiltersStr !== currentFiltersStr) {
    setSyncedFiltersStr(currentFiltersStr);
    if (currentFiltersStr) {
      setSelectedFilters(JSON.parse(currentFiltersStr) as Record<string, string[]>);
    }
  }

  // Closing must NOT reset `actualPlacement`.
  //
  // The panel stays mounted through its exit transition (see `shouldRender`), so
  // a reset here lands on something still on screen: a dropdown that had flipped
  // to the opposite side snaps back the moment it starts fading, sliding roughly
  // its own width sideways on the way out. It showed up on whichever filter sits
  // nearest an edge — the last column on tablet, and the same column on desktop
  // once the window is narrow enough to force the flip.
  //
  // Nothing is lost by dropping it: opening recomputes the placement from the
  // trigger's current rect (see the effect above), so the value left behind is
  // never read again.

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside the entire component container
      // A floating panel is portalled out of the container: a click inside it is not outside.
      if (dropdownRef.current?.contains(event.target as Node)) return;
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (!isOpen) return undefined;

    // Use a small delay to avoid closing immediately after opening
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // A floating panel, and any panel on mobile, is `fixed`: it follows its trigger while anything scrolls or the window
  // resizes.
  useEffect(() => {
    if (!isOpen || !(floating || isMobile)) return undefined;
    const reposition = (event: Event) => {
      const dropdown = dropdownRef.current;
      if (!dropdown) return;
      // The listener captures every scroll, the panel's own option list too: that one moves nothing, and re-placing
      // the panel under a list being scrolled would only fight it.
      if (event.type === 'scroll' && event.target instanceof Node && dropdown.contains(event.target)) return;
      const card = cardRef.current;
      const layout = floatingPanelLayout(
        dropdown,
        card,
        triggerRef.current,
        placement,
        collisionBoundary,
        floatingSideRef.current,
      );
      if (layout) {
        dropdown.style.left = isMobile ? '' : layout.left;
        dropdown.style.top = layout.top;
        dropdown.style.bottom = layout.bottom;
        if (card) card.style.maxHeight = layout.maxHeight;
        floatingSideRef.current = layout.side;
        setFloatingSide(layout.side);
        if (floating && !isMobile && layout.detached) setIsOpen(false);
      }
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [isOpen, floating, isMobile, placement, collisionBoundary]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleToggleOption = (sectionId: string, optionId: string, sectionType: string) => {
    setSelectedFilters(prev => {
      const current = prev[sectionId] || [];

      if (sectionType === 'radio') {
        return {
          ...prev,
          [sectionId]: [optionId],
        };
      } else {
        if (current.includes(optionId)) {
          return {
            ...prev,
            [sectionId]: current.filter(id => id !== optionId),
          };
        } else {
          return {
            ...prev,
            [sectionId]: [...current, optionId],
          };
        }
      }
    });
  };

  const handleSelectAll = (sectionId: string, section: FilterSection) => {
    const allOptionIds = section.options.map(opt => opt.id);
    const currentSelection = selectedFilters[sectionId] || [];
    const isAllSelected = allOptionIds.every(id => currentSelection.includes(id));

    setSelectedFilters(prev => ({
      ...prev,
      [sectionId]: isAllSelected ? [] : allOptionIds,
    }));
  };

  const handleReset = () => {
    const defaults: Record<string, string[]> = {};
    sections.forEach(section => {
      defaults[section.id] = section.defaultSelected || [];
    });
    setSelectedFilters(defaults);
    onReset?.();
    setIsOpen(false);
  };

  const handleApply = () => {
    onApply(selectedFilters);
    // No placement reset — see the note above the outside-click effect. `Reset`
    // never did one, which is why only Apply and the dismiss paths slid.
    setIsOpen(false);
  };

  const getActiveFiltersCount = () => {
    return Object.values(selectedFilters).reduce((acc: number, curr: string[]) => acc + curr.length, 0);
  };

  // Desktop (absolute) positioning classes based on placement. A `fixed` panel
  // (mobile, floating) is placed by the layout effect instead.
  const getDropdownPositionClasses = () => {
    // Desktop positioning based on placement prop
    const desktopClasses = {
      'bottom-start': 'top-full left-0 mt-2',
      'bottom-end': 'top-full right-0 mt-2',
      bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    };

    return desktopClasses[actualPlacement];
  };

  const isFloating = floating && !isMobile;
  // A `fixed` panel (floating, or on mobile) above its trigger grows from, and slides in towards, its bottom edge.
  const opensAbove = (isFloating || isMobile) && floatingSide === 'above';
  // Floating: the panel leaves this component's box (and whatever clips it) for the active portal container.
  const renderPanel = (panel: ReactNode) =>
    isFloating ? createPortal(panel, portalContainer ?? document.body) : panel;

  return (
    <div ref={containerRef} className={cn('relative inline-block', className)}>
      {/* Trigger */}
      {triggerElement ? (
        <div ref={triggerRef as RefObject<HTMLDivElement>} onClick={() => setIsOpen(!isOpen)}>
          {triggerElement}
        </div>
      ) : (
        <Button
          variant="link"
          size="compact"
          noPaddingX
          ref={triggerRef as RefObject<HTMLButtonElement>}
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          // Filters applied: the trigger holds the accent. Otherwise the secondary text, the primary on hover.
          data-state={getActiveFiltersCount() > 0 ? 'active' : undefined}
          data-tone="neutral"
        >
          <span className="text-h5">{triggerLabel}</span>
        </Button>
      )}

      {/* Dropdown Panel — kept mounted briefly on close to play exit transition. */}
      {shouldRender &&
        renderPanel(
          <div
            ref={dropdownRef}
            className={cn(
              'z-50',
              opensAbove ? 'origin-bottom' : 'origin-top',
              // CSS transitions (not @keyframes) so mid-animation interruption
              // interpolates smoothly from the current computed value.
              'transition-[opacity,transform] duration-200 ease-out',
              'will-change-[opacity,transform]',
              isVisible
                ? 'translate-y-0 scale-100 opacity-100'
                : cn('pointer-events-none scale-95 opacity-0', opensAbove ? 'translate-y-2' : '-translate-y-2'),
              isMobile
                ? 'fixed left-4 right-4 mx-auto max-w-[320px]'
                : isFloating
                  ? 'fixed w-[320px]'
                  : 'absolute w-[320px]',
              !isFloating && !isMobile && getDropdownPositionClasses(),
              dropdownClassName,
            )}
            // No `style` here: the mobile `top` is a DOM measurement and is owned
            // by the layout effect above.
          >
            {/* A floating panel short of room caps this card (`maxHeight`): the list shrinks, the buttons do not. */}
            <div
              ref={cardRef}
              data-filter-panel="card"
              className="flex flex-col overflow-hidden rounded-md border border-ods-border bg-ods-bg p-4 shadow-xl"
            >
              <div data-filter-panel="list" className="max-h-[250px] min-h-0 flex-1 overflow-y-auto">
                {sections.map((section, sectionIndex) => {
                  const sectionSelection = selectedFilters[section.id] || [];
                  const allSelected = section.options.every(opt => sectionSelection.includes(opt.id));

                  return (
                    <div key={section.id} className={cn('space-y-2', sectionIndex > 0 && 'mt-4')}>
                      {/* Section Header — sticky so title + Select All stay visible while options scroll. */}
                      <div
                        data-filter-panel="section-header"
                        className="sticky top-0 z-10 flex items-center justify-between bg-ods-bg pb-2"
                      >
                        <h3 className="text-ods-text-secondary text-h5">{section.title}</h3>
                        {section.allowSelectAll && section.type === 'checkbox' && (
                          <Button
                            variant="link"
                            size="compact"
                            noPaddingX
                            data-tone="neutral"
                            onClick={() => handleSelectAll(section.id, section)}
                          >
                            {allSelected ? 'Deselect All' : 'Select All'}
                          </Button>
                        )}
                      </div>

                      {/* Options Container */}
                      <div className="divide-y divide-ods-border overflow-hidden rounded-md border border-ods-border bg-ods-bg">
                        {section.options.map((option, index) => {
                          // Handle separator type
                          if (option.type === 'separator') {
                            return (
                              <div
                                key={`${section.id}-separator-${index}`}
                                className="my-1 border-t border-ods-border"
                              />
                            );
                          }

                          const isSelected = sectionSelection.includes(option.id);

                          return (
                            <Button
                              variant="row"
                              type="button"
                              key={`${section.id}-${option.id}-${index}`}
                              data-filter-panel="option"
                              onClick={() => handleToggleOption(section.id, option.id, section.type)}
                              data-state={isSelected ? 'active' : undefined}
                              // A checked option sits on the raised surface; the hover still shows over it.
                              data-tone="surface"
                            >
                              <FilterCheckbox checked={isSelected} />
                              <span
                                className="min-w-0 flex-1 truncate text-ods-text-primary text-h4"
                                title={option.label}
                              >
                                {option.label}
                              </span>
                              {option.count !== undefined && (
                                <span className="shrink-0 text-ods-text-secondary text-h6">
                                  {option.count.toLocaleString()}
                                </span>
                              )}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Action Buttons */}
              <div className="mt-4 flex shrink-0 gap-3">
                <Button variant="outline" onClick={handleReset} size="default">
                  Reset
                </Button>
                <Button variant="accent" onClick={handleApply} size="default">
                  Apply
                </Button>
              </div>
            </div>
          </div>,
        )}
    </div>
  );
};

// Export convenience hook for managing filter state
export const useFiltersDropdown = (initialSections: FilterSection[]) => {
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    initialSections.forEach(section => {
      if (section.defaultSelected) {
        initial[section.id] = section.defaultSelected;
      }
    });
    return initial;
  });

  const handleApply = (filters: Record<string, string[]>) => {
    setAppliedFilters(filters);
  };

  const handleReset = () => {
    const defaults: Record<string, string[]> = {};
    initialSections.forEach(section => {
      defaults[section.id] = section.defaultSelected || [];
    });
    setAppliedFilters(defaults);
  };

  const getActiveFiltersCount = () => {
    return Object.values(appliedFilters).reduce((acc: number, curr: string[]) => acc + curr.length, 0);
  };

  return {
    appliedFilters,
    handleApply,
    handleReset,
    getActiveFiltersCount,
  };
};

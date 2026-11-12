'use client';

import { usePreventScroll } from '@react-aria/overlays';
import { type ReactNode, type TouchEvent, useRef, useState } from 'react';
import { useFocusTrap } from '../../hooks/ui/use-focus-trap';
import { useMdUp } from '../../hooks/ui/use-media-query';
import { cn } from '../../utils';
import { OVERLAY_BACKDROP_CLASS } from '../ui/drawer';
import { PortalContainerContext } from '../ui/portal-container';

/** The phone top bar's height: the panel opens below it, as the burger menu does. */
const HEADER_HEIGHT = 56;
/** How far a finger has to move before the gesture is read as a swipe or as a scroll. */
const SWIPE_LOCK_PX = 8;
/** How far a swipe towards the panel's edge closes it; a shorter one springs back. */
export const MOBILE_SIDE_PANEL_SWIPE_CLOSE_PX = 64;

export interface MobileSidePanelProps {
  /** Whether the panel is open. */
  open: boolean;
  /** Asked to close: a tap on the scrim, Escape, or a swipe towards the panel's edge. */
  onClose: () => void;
  /** The panel's accessible name ("Chats"). */
  label: string;
  /** The edge it slides from. Default `'left'`. */
  side?: 'left' | 'right';
  children: ReactNode;
}

/**
 * A phone panel that slides in from a side, below the top bar, over a scrim: the burger menu's drawer
 * (`MobileBurgerMenu`), for any content. 320px wide; under 400px of window it takes the whole width. It closes on a
 * tap on the scrim, Escape, and a swipe towards its edge, which it follows under the finger. Phone only (`md:hidden`):
 * mount it inside `AppLayout`'s sidebar row, which it covers (`AppLayout` `mobileStartPanel`).
 *
 * Stays mounted while closed (inert, off screen), so its content keeps its state and the slide out plays.
 */
export function MobileSidePanel({ open, onClose, label, side = 'left', children }: MobileSidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [portalHost, setPortalHost] = useState<HTMLDivElement | null>(null);
  // The finger's travel towards the panel's edge while a swipe is on, in px (0 otherwise).
  const [drag, setDrag] = useState(0);
  // The same travel for the lift: a quick flick moves and lifts before React renders the move, and a value read from
  // the last render would still be 0.
  const dragRef = useRef(0);
  const touchRef = useRef<{ x: number; y: number; swiping: boolean | null } | null>(null);

  // The panel is drawn on a phone only (`md:hidden`). A host may leave it open when the window widens past `md` (a
  // tablet turned to landscape): hidden, it must not keep the page's scroll locked or the focus held.
  const mdUp = useMdUp();
  const active = open && mdUp !== true;
  usePreventScroll({ isDisabled: !active });
  useFocusTrap(panelRef, active, { onEscape: onClose });

  const fromRight = side === 'right';
  // Positive travel moves the panel towards its own edge (left for a left panel).
  const towardsEdge = (dx: number) => (fromRight ? dx : -dx);

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    touchRef.current = touch ? { x: touch.clientX, y: touch.clientY, swiping: null } : null;
  };
  const onTouchMove = (event: TouchEvent) => {
    const start = touchRef.current;
    const touch = event.touches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (start.swiping === null) {
      if (Math.abs(dx) < SWIPE_LOCK_PX && Math.abs(dy) < SWIPE_LOCK_PX) return;
      // A sideways gesture is a swipe; anything else stays the list's own scroll.
      start.swiping = Math.abs(dx) > Math.abs(dy);
    }
    if (start.swiping) {
      dragRef.current = Math.max(0, towardsEdge(dx));
      setDrag(dragRef.current);
    }
  };
  const onTouchEnd = () => {
    const swiped = dragRef.current >= MOBILE_SIDE_PANEL_SWIPE_CLOSE_PX;
    touchRef.current = null;
    dragRef.current = 0;
    setDrag(0);
    if (swiped) onClose();
  };

  return (
    // Its own stacking layer below the top bar, as the burger menu's: the scrim, the panel and the host its popups
    // portal into. The layer takes no clicks; its children opt back in. `overflow-x-clip`: the closed panel waits
    // past the screen's edge, which must not widen the page.
    <div
      data-testid="mobile-side-panel-layer"
      className="pointer-events-none absolute inset-0 z-[101] overflow-x-clip md:hidden"
      style={{ top: HEADER_HEIGHT }}
    >
      <div
        className={cn(
          'absolute inset-0',
          OVERLAY_BACKDROP_CLASS,
          'transition-all duration-300 motion-reduce:transition-none',
          open ? 'pointer-events-auto opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
        aria-hidden="true"
        data-testid="mobile-side-panel-scrim"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        inert={!open || undefined}
        data-dragging={drag > 0 || undefined}
        className={cn(
          'absolute inset-y-0 flex w-full flex-col border-ods-border-panel bg-ods-panel min-[400px]:w-[320px]',
          fromRight ? 'right-0 min-[400px]:border-l' : 'left-0 min-[400px]:border-r',
          // Under the finger the panel follows it at once; let go, it slides the rest of the way (or back).
          drag > 0 ? 'transition-none' : 'transition-transform duration-300 ease-out motion-reduce:transition-none',
          open ? 'pointer-events-auto translate-x-0' : fromRight ? 'translate-x-full' : '-translate-x-full',
        )}
        style={drag > 0 ? { transform: `translateX(${fromRight ? drag : -drag}px)` } : undefined}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <PortalContainerContext.Provider value={portalHost}>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </PortalContainerContext.Provider>
        <div ref={setPortalHost} />
      </div>
    </div>
  );
}

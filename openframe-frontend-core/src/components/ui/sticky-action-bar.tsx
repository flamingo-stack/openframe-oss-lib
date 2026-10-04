'use client';

import { type ReactNode, type RefObject, useEffect, useState } from 'react';
import { cn } from '../../utils/cn';

export interface UseBetweenAnchorsOptions {
  /** The bar may show once this element has scrolled above the viewport top. */
  after: RefObject<Element | null>;
  /** The bar hides again once this element enters the viewport. */
  before: RefObject<Element | null>;
  /** Height of anything fixed at the top (a sticky header) that covers `after`. */
  topOffset?: number;
}

/**
 * True while the page is scrolled BETWEEN two anchors: past the first, not yet
 * at the second. Used to show a sticky call to action only when no other
 * instance of it is on screen (the hero's has gone, the closing one has not
 * arrived), so the same button is never visible twice.
 */
export function useBetweenAnchors({ after, before, topOffset = 0 }: UseBetweenAnchorsOptions): boolean {
  const [between, setBetween] = useState(false);

  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const afterEl = after.current;
      const beforeEl = before.current;
      if (!afterEl) {
        setBetween(false);
        return;
      }
      const pastFirst = afterEl.getBoundingClientRect().bottom < topOffset;
      const beforeSecond = beforeEl ? beforeEl.getBoundingClientRect().top > window.innerHeight : true;
      setBetween(pastFirst && beforeSecond);
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [after, before, topOffset]);

  return between;
}

export interface StickyActionBarProps {
  /** Slides in when true, out when false. */
  visible: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * A bar fixed to the bottom of the screen that holds one action, padded for
 * the home-indicator safe area. Off screen it is inert: not focusable, not
 * clickable, hidden from assistive tech.
 */
export function StickyActionBar({ visible, children, className }: StickyActionBarProps) {
  return (
    <div
      aria-hidden={!visible}
      inert={!visible}
      className={cn(
        'fixed inset-x-0 bottom-0 z-[44] border-t border-ods-border bg-ods-bg px-4 pt-3 transition-transform duration-200 ease-out motion-reduce:transition-none',
        'pb-[calc(1rem+env(safe-area-inset-bottom))]',
        visible ? 'translate-y-0' : 'pointer-events-none translate-y-full',
        className,
      )}
    >
      {children}
    </div>
  );
}

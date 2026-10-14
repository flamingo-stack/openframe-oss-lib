'use client';

import { type ReactNode, type RefObject, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn';
import { SkeletonText } from './skeleton';

/**
 * Holding a layout while its content is read, the two ways that are right at
 * EVERY width. A placeholder of a guessed size (a `w-40` bar, a `h-[120px]`
 * box) is only right at the widths it was tuned at: text wraps where the words
 * make it wrap, so the placeholder has to be made of the words, or of the real
 * layout, to wrap where the content will.
 *
 * - `TextHold`: an inline stand-in exactly as wide as the words it is given
 *   (same font, same letter spacing, because it IS those words, not shown).
 *   `bar` draws a `SkeletonText` of as many lines as the words take; `blank`
 *   only keeps their space.
 * - `LayoutHold`: a block as tall as the real layout rendered inside it, kept
 *   invisible and inert: the layout's own height, at any width.
 *
 * Neither is shown or read out; both are removed for assistive technology.
 */
export interface TextHoldProps {
  /** The words whose width is held (the content's own, or a stand-in of its length). */
  children: ReactNode;
  /** `bar`: a `SkeletonText` of as many lines as the words take. `blank`: the space only. */
  variant?: 'bar' | 'blank';
  className?: string;
}

export function TextHold({ children, variant = 'bar', className }: TextHoldProps) {
  const hold = useRef<HTMLSpanElement>(null);
  const words = useRef<HTMLSpanElement>(null);
  const lines = useLineCount(hold, words, variant === 'bar');
  return (
    <span
      ref={hold}
      aria-hidden
      className={cn('pointer-events-none select-none', variant === 'bar' && 'relative inline-block', className)}
    >
      <span ref={words} className="invisible">
        {children}
      </span>
      {lines > 0 ? (
        // `justify-around`: each `Skeleton` sits in the middle of the line it stands for.
        <SkeletonText lines={lines} className="absolute inset-0 flex flex-col justify-around space-y-0" />
      ) : null}
    </span>
  );
}

/** How many lines the words take (one box per line), kept current as the width changes. */
function useLineCount(
  hold: RefObject<HTMLSpanElement | null>,
  words: RefObject<HTMLSpanElement | null>,
  enabled: boolean,
): number {
  const [lines, setLines] = useState(0);
  useLayoutEffect(() => {
    const box = hold.current;
    if (!enabled || !box) return undefined;
    const measure = () => setLines(words.current?.getClientRects().length ?? 0);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [hold, words, enabled]);
  return lines;
}

export interface LayoutHoldProps {
  /** The real layout, rendered with the data at hand. */
  children: ReactNode;
  className?: string;
}

export function LayoutHold({ children, className }: LayoutHoldProps) {
  return (
    <div aria-hidden inert className={cn('invisible', className)}>
      {children}
    </div>
  );
}

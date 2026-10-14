'use client';

import { type ReactNode, type RefObject, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn';
import { Skeleton } from './skeleton';

/**
 * Holding a layout while its content is read, the two ways that are right at
 * EVERY width. A placeholder of a guessed size (a `w-40` bar, a `h-[120px]`
 * box) is only right at the widths it was tuned at: text wraps where the words
 * make it wrap, so the placeholder has to be made of the words, or of the real
 * layout, to wrap where the content will.
 *
 * - `TextHold`: an inline stand-in exactly as wide as the words it is given
 *   (same font, same letter spacing, because it IS those words, not shown).
 *   `bar` draws a `Skeleton` over each line the words take; `blank` only keeps
 *   their space.
 * - `LayoutHold`: a block as tall as the real layout rendered inside it, kept
 *   invisible and inert: the layout's own height, at any width.
 *
 * Neither is shown or read out; both are removed for assistive technology.
 */
export interface TextHoldProps {
  /** The words whose width is held (the content's own, or a stand-in of its length). */
  children: ReactNode;
  /** `bar`: a `Skeleton` over each line the words take. `blank`: the space only. */
  variant?: 'bar' | 'blank';
  className?: string;
}

export function TextHold({ children, variant = 'bar', className }: TextHoldProps) {
  const words = useRef<HTMLSpanElement>(null);
  const bars = useLineBars(words, variant === 'bar');
  return (
    <span
      aria-hidden
      className={cn(
        // The words keep their space and their line breaks, unseen; `bar` draws a `Skeleton` over each line they take.
        'pointer-events-none invisible select-none',
        variant === 'bar' && 'relative',
        className,
      )}
    >
      <span ref={words}>{children}</span>
      {bars.map(bar => (
        <Skeleton
          key={`${bar.top}:${bar.left}`}
          className="visible absolute h-4"
          style={{ top: bar.top, left: bar.left, width: bar.width }}
        />
      ))}
    </span>
  );
}

interface LineBar {
  top: number;
  left: number;
  width: number;
}

/** The `Skeleton` bar's height (`h-4`), centred on each line. */
const BAR_HEIGHT_PX = 16;

/**
 * One bar per line the words take, measured from their own line boxes and kept
 * current as the width changes: each bar spans its line's words and sits in the
 * middle of the line. Positions are relative to the hold's first line, which is
 * where an inline box's absolutely positioned children are placed.
 */
function useLineBars(words: RefObject<HTMLSpanElement | null>, enabled: boolean): LineBar[] {
  const [bars, setBars] = useState<LineBar[]>([]);
  useLayoutEffect(() => {
    const element = words.current;
    if (!enabled || !element) return undefined;
    const measure = () => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const lines = new Map<number, DOMRect>();
      for (const rect of Array.from(range.getClientRects())) {
        if (rect.width === 0) continue;
        const key = Math.round(rect.top);
        const line = lines.get(key);
        lines.set(
          key,
          line
            ? new DOMRect(
                Math.min(line.left, rect.left),
                line.top,
                Math.max(line.right, rect.right) - Math.min(line.left, rect.left),
                line.height,
              )
            : rect,
        );
      }
      const all = [...lines.values()].sort((a, b) => a.top - b.top || a.left - b.left);
      const first = element.getClientRects()[0];
      setBars(
        !first
          ? []
          : all.map(line => ({
              top: Math.round(line.top - first.top + (line.height - BAR_HEIGHT_PX) / 2),
              left: Math.round(line.left - first.left),
              width: Math.round(line.width),
            })),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    const block = element.closest('p, div, li, dd, dt, section') ?? element.parentElement;
    if (block) observer.observe(block);
    return () => observer.disconnect();
  }, [words, enabled]);
  return bars;
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

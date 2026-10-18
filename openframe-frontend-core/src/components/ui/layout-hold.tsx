import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { SKELETON_SURFACE_CLASS } from './skeleton-surface';

/**
 * Holding text while its layout is read, the way that is right at EVERY width. A placeholder of a guessed size (a `w-40` bar, a `h-[120px]`
 * box) is only right at the widths it was tuned at: text wraps where the words
 * make it wrap, so the placeholder has to be made of the words, or of the real
 * layout, to wrap where the content will.
 *
 * - `TextHold`: an inline bar exactly as wide as the words it is given (the page's own words, never invented)
 *   (same font, same letter spacing, because it IS those words, not shown).
 *   `bar` draws one skeleton bar per line the words take, each as wide as
 *   its line, in plain CSS (no measuring, so it is in the server's HTML);
 *   `blank` only keeps their space.
 *
 * It is not shown or read out; it is removed for assistive technology.
 */
export interface TextHoldProps {
  /** The words whose width is held: the page's own static words, never invented ones. */
  children: ReactNode;
  /** `bar`: one skeleton bar per line the words take. `blank`: the space only. */
  variant?: 'bar' | 'blank';
  className?: string;
}

/** A rounded rectangle filling whatever box it is drawn in: the shape of each line's bar. */
const ROUNDED_BAR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100%25' height='100%25' rx='6'/%3E%3C/svg%3E")`;
/**
 * Each line's bar: a text-high band in the middle of the line, so wrapped lines are separate bars with
 * a gap between them. A line box's background is as tall as the font's whole ascent and descent, which in
 * DM Sans fills the line, so unmasked the lines of a paragraph touch and read as one block.
 */
const BAR_MASK = `${ROUNDED_BAR} center / 100% min(1em, calc(1lh - 6px)) no-repeat`;
const BAR_STYLE: CSSProperties = { mask: BAR_MASK, WebkitMask: BAR_MASK };

export function TextHold({ children, variant = 'bar', className }: TextHoldProps) {
  const bar = variant === 'bar';
  return (
    <span
      aria-hidden
      className={cn(
        // `bar`: the words themselves, unseen, on the skeleton's surface. The span stays INLINE, so the
        // browser paints one bar per line the words take, each exactly as wide as that line, and
        // `box-decoration-clone` gives every line its own bar (and its own mask, `BAR_STYLE`). Pure CSS: it
        // is drawn in the server's HTML, before any script runs (a loading state streamed by the server
        // is often replaced before it hydrates).
        bar ? cn(SKELETON_SURFACE_CLASS, 'rounded-md box-decoration-clone text-transparent') : 'invisible',
        // A hold is never selectable or clickable, whatever it wraps.
        'pointer-events-none select-none',
        className,
      )}
      style={bar ? BAR_STYLE : undefined}
    >
      {children}
    </span>
  );
}

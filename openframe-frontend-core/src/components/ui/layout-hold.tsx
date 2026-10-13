import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

/**
 * Holding a layout while its content is read, the two ways that are right at
 * EVERY width. A placeholder of a guessed size (a `w-40` bar, a `h-[120px]`
 * box) is only right at the widths it was tuned at: text wraps where the words
 * make it wrap, so the placeholder has to be made of the words, or of the real
 * layout, to wrap where the content will.
 *
 * - `TextHold`: an inline stand-in exactly as wide as the words it is given
 *   (same font, same letter spacing, because it IS those words, not shown).
 *   `bar` draws it as a pulsing grey bar; `blank` only keeps its space.
 * - `LayoutHold`: a block as tall as the real layout rendered inside it, kept
 *   invisible and inert: the layout's own height, at any width.
 *
 * Neither is shown or read out; both are removed for assistive technology.
 */
export interface TextHoldProps {
  /** The words whose width is held (the content's own, or a stand-in of its length). */
  children: ReactNode;
  /** `bar`: a pulsing grey bar of that width. `blank`: the width only. */
  variant?: 'bar' | 'blank';
  className?: string;
}

export function TextHold({ children, variant = 'bar', className }: TextHoldProps) {
  return (
    <span
      aria-hidden
      className={cn(
        variant === 'bar' ? 'animate-pulse rounded bg-ods-border text-transparent' : 'invisible',
        // A hold is never selectable or clickable, whatever it wraps.
        'pointer-events-none select-none',
        className,
      )}
    >
      {children}
    </span>
  );
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

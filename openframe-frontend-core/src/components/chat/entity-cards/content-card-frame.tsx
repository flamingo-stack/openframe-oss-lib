import type React from 'react';
import { cn } from '../../../utils/cn';

/**
 * THE card surface of every content and admin card: a rounded border on the
 * page's own background (a card is its border, never a second surface), an
 * accent border and a soft glow on hover, no lift. `isolate` gives the card its
 * own stacking context, so a cover that scales on hover keeps the rounded clip
 * (without it the top corners turn square for the length of the transition).
 *
 * `AdminContentCard` (cover cards) and every admin card with its own layout
 * (a thumbnail row, a table of facts, a row of actions) draw this frame, so the
 * design changes in ONE place.
 */
export const CONTENT_CARD_FRAME_CLASS = cn(
  'group isolate overflow-hidden rounded-2xl',
  'border border-ods-border bg-transparent',
  'transition-[border-color,box-shadow] duration-300 ease-out',
  'hover:border-ods-accent hover:shadow-lg hover:shadow-ods-accent/[0.08]',
);

/** The same frame for a card's loading skeleton: no hover, nothing to point at. */
export const CONTENT_CARD_SKELETON_FRAME_CLASS = 'overflow-hidden rounded-2xl border border-ods-border bg-transparent';

export interface ContentCardFrameProps extends React.HTMLAttributes<HTMLElement> {
  /** The element: an `article` for a card that stands alone, a `div` inside a list item. */
  as?: 'article' | 'div' | 'li';
}

export function ContentCardFrame({ as: Tag = 'article', className, children, ...rest }: ContentCardFrameProps) {
  return (
    <Tag className={cn(CONTENT_CARD_FRAME_CLASS, className)} {...rest}>
      {children}
    </Tag>
  );
}

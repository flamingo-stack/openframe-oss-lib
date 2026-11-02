'use client';

import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from 'react';
import { Chevron02LeftIcon } from '../icons-v2-generated/arrows/chevron-02-left-icon';
import { Chevron02RightIcon } from '../icons-v2-generated/arrows/chevron-02-right-icon';
import { Button } from './button';

export interface StepArrowButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Which way it moves: the chevron points that way. */
  direction: 'previous' | 'next';
  /** Required: the button is a glyph only. */
  'aria-label': string;
  /** A glyph in place of the chevron, for a step that does something else (a deck's "skip to end" at its start). */
  glyph?: ReactNode;
}

/**
 * THE previous / next arrow that steps through slides: a carousel's controls row (`SnapCarouselControls`) and a
 * presentation's navbar draw it, so every step arrow is the same round 36px control (the `stepper` kind). Not the
 * floating arrows of a `CardsStrip`, which are the outline icon button over the cards. `className` is layout only.
 */
export const StepArrowButton = forwardRef<HTMLButtonElement, StepArrowButtonProps>(
  ({ direction, glyph, type = 'button', ...props }, ref) => {
    const Icon = direction === 'previous' ? Chevron02LeftIcon : Chevron02RightIcon;
    return (
      <Button ref={ref} type={type} variant="stepper" {...props}>
        {glyph ?? <Icon />}
      </Button>
    );
  },
);
StepArrowButton.displayName = 'StepArrowButton';

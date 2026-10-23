'use client';

import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { Chevron02LeftIcon } from '../icons-v2-generated/arrows/chevron-02-left-icon';
import { Chevron02RightIcon } from '../icons-v2-generated/arrows/chevron-02-right-icon';
import { Button } from './button';

export interface CarouselStepButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Which way the carousel moves: the chevron points that way. */
  direction: 'previous' | 'next';
  /** Required: the button is a glyph only. */
  'aria-label': string;
}

/**
 * THE previous / next arrow of a carousel's controls row: the `stepper` kind (a round outline with no fill) with its
 * chevron. Every carousel that steps one slide at a time under its track draws these, so they look the same
 * everywhere. Not the floating arrows of a `CardsStrip`, which are the outline icon button over the cards.
 * `className` is layout only.
 */
export const CarouselStepButton = forwardRef<HTMLButtonElement, CarouselStepButtonProps>(
  ({ direction, type = 'button', ...props }, ref) => {
    const Icon = direction === 'previous' ? Chevron02LeftIcon : Chevron02RightIcon;
    return (
      <Button ref={ref} type={type} variant="stepper" {...props}>
        <Icon />
      </Button>
    );
  },
);
CarouselStepButton.displayName = 'CarouselStepButton';

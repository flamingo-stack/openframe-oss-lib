'use client';

import * as HoverCardPrimitive from '@radix-ui/react-hover-card';
import { type ComponentPropsWithoutRef, type ComponentRef, forwardRef } from 'react';

import { cn } from '../utils/cn';
import { usePortalContainer } from './ui/portal-container';

/**
 * Rich hover content — a profile preview, a stat breakdown, a record card.
 *
 * WHEN NOT TO USE `Tooltip` INSTEAD. A tooltip is `role="tooltip"`: a short,
 * static description OF its trigger. Anything interactive inside one is
 * unreachable by keyboard and is announced as part of the trigger's
 * description, so a disclosure, link or button in a tooltip is an
 * accessibility bug. A hover card is a non-modal popover that happens to open
 * on hover: it may hold interactive content, stays open while the pointer is
 * inside it, and opens on focus for keyboard users.
 *
 * Text only, no interaction -> `Tooltip`. Anything clickable or expandable ->
 * `HoverCard`.
 */
const HoverCard = HoverCardPrimitive.Root;

const HoverCardTrigger = HoverCardPrimitive.Trigger;

const HoverCardContent = forwardRef<
  ComponentRef<typeof HoverCardPrimitive.Content>,
  ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>
>(
  (
    {
      className,
      // Pin the card's TOP-LEFT to the trigger. Content that expands then grows
      // DOWNWARD from a fixed point; with a centered/auto side the popper
      // re-solves its position on every resize and the card appears to jump,
      // or flips to the other side mid-interaction.
      align = 'start',
      side = 'bottom',
      sideOffset = 8,
      collisionPadding = 16,
      style,
      ...props
    },
    ref,
  ) => (
    // Portalled so an `overflow: hidden` ancestor (a table cell, a card) cannot
    // clip it.
    <HoverCardPrimitive.Portal container={usePortalContainer()}>
      <HoverCardPrimitive.Content
        ref={ref}
        align={align}
        side={side}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        avoidCollisions
        sticky="always"
        className={cn(
          // A height cap with internal scroll is what stops growing content
          // from ever exceeding the viewport — which is what forces a flip.
          'z-[2147483647] max-h-[min(70vh,560px)] w-64 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain',
          'rounded-md border border-ods-border bg-ods-card p-4 text-ods-text-primary shadow-md outline-none',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          className,
        )}
        style={style}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  ),
);
HoverCardContent.displayName = HoverCardPrimitive.Content.displayName;

export { HoverCard, HoverCardTrigger, HoverCardContent };

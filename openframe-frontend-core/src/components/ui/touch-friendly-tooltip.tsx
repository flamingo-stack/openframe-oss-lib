'use client';

import { type ReactElement, type ReactNode, useCallback, useRef, useState } from 'react';
import { cn } from '../../utils/cn';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

/**
 * The one tooltip allowed open at a time, across every instance — tapping a
 * second trigger dismisses the first, since touch has no "mouse left" to close
 * it. Module-level on purpose: instances live in unrelated subtrees.
 */
let dismissOpenTooltip: (() => void) | null = null;

export interface TouchFriendlyTooltipProps {
  /** Tooltip content (a text, or lines of one); when absent the children render bare, with no trigger wiring. */
  content?: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** More classes for the tooltip's box, merged over its own (a design's narrower `max-w-*`, say). */
  contentClassName?: string;
  children: ReactElement;
}

/**
 * Hover tooltip that also works on touch, where Radix's hover/focus model never
 * opens: a tap toggles it instead. Wraps its own `TooltipProvider`, so it can be
 * dropped anywhere without a provider up the tree.
 */
export function TouchFriendlyTooltip({
  content,
  side = 'left',
  contentClassName,
  children,
}: TouchFriendlyTooltipProps) {
  const [open, setOpen] = useState(false);
  const isTouchRef = useRef(false);
  const close = useCallback(() => setOpen(false), []);

  if (!content) return children;

  const toggleFromTouch = () => {
    setOpen(prev => {
      const next = !prev;
      if (next) {
        if (dismissOpenTooltip && dismissOpenTooltip !== close) dismissOpenTooltip();
        dismissOpenTooltip = close;
      } else if (dismissOpenTooltip === close) {
        dismissOpenTooltip = null;
      }
      return next;
    });
  };

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger
          asChild
          onPointerDown={e => {
            isTouchRef.current = e.pointerType === 'touch';
            if (!isTouchRef.current) return;
            e.preventDefault();
            toggleFromTouch();
          }}
          onFocus={e => {
            if (isTouchRef.current) e.preventDefault();
          }}
          onClick={e => {
            if (isTouchRef.current) e.preventDefault();
          }}
        >
          {children}
        </TooltipTrigger>
        <TooltipContent side={side} className={cn('max-w-xs', contentClassName)}>
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

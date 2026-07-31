'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'

export interface ChatHeaderIconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Which side carries the 1px cell divider. Trailing cells (close, ⋯,
   *  archive) use the default `'left'`; a leading cell (the back chevron) uses
   *  `'right'`; `'none'` drops it. */
  divider?: 'left' | 'right' | 'none'
}

/**
 * Square 56×56 icon cell used in the chat panel's top-navigation
 * (archive / restore / close, the `⋯` menu trigger, and the leading back
 * chevron). A border on one side acts as the 1px divider between cells.
 *
 * On hover only the background changes (`ods-bg-hover`) — the icon keeps its
 * `ods-text-secondary` colour. `forwardRef` + prop spread so it works as a
 * Radix `asChild` trigger.
 */
export const ChatHeaderIconButton = React.forwardRef<
  HTMLButtonElement,
  ChatHeaderIconButtonProps
>(({ className, children, type = 'button', divider = 'left', ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={cn(
      'flex size-14 shrink-0 items-center justify-center border-ods-border',
      divider === 'left' && 'border-l',
      divider === 'right' && 'border-r',
      'text-ods-text-secondary transition-colors hover:bg-ods-bg-hover',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent',
      className,
    )}
    {...props}
  >
    {children}
  </button>
))
ChatHeaderIconButton.displayName = 'ChatHeaderIconButton'

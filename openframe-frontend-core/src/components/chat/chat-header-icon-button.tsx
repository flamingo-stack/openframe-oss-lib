'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'

export interface ChatHeaderIconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

/**
 * Square 56×56 icon cell used in the chat panel's top-navigation
 * (archive / restore / close, and the `⋯` menu trigger). A left border acts
 * as the 1px divider between cells.
 *
 * On hover only the background changes (`ods-bg-hover`) — the icon keeps its
 * `ods-text-secondary` colour. `forwardRef` + prop spread so it works as a
 * Radix `asChild` trigger.
 */
export const ChatHeaderIconButton = React.forwardRef<
  HTMLButtonElement,
  ChatHeaderIconButtonProps
>(({ className, children, type = 'button', ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={cn(
      'flex size-14 shrink-0 items-center justify-center border-l border-ods-border',
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

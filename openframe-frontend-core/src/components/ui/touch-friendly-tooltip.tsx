'use client'

import * as React from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'

/**
 * The one tooltip allowed open at a time, across every instance — tapping a
 * second trigger dismisses the first, since touch has no "mouse left" to close
 * it. Module-level on purpose: instances live in unrelated subtrees.
 */
let dismissOpenTooltip: (() => void) | null = null

export interface TouchFriendlyTooltipProps {
  /** Tooltip text; when absent the children render bare, with no trigger wiring. */
  content?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  children: React.ReactElement
}

/**
 * Hover tooltip that also works on touch, where Radix's hover/focus model never
 * opens: a tap toggles it instead. Wraps its own `TooltipProvider`, so it can be
 * dropped anywhere without a provider up the tree.
 */
export function TouchFriendlyTooltip({ content, side = 'left', children }: TouchFriendlyTooltipProps) {
  const [open, setOpen] = React.useState(false)
  const isTouchRef = React.useRef(false)
  const close = React.useCallback(() => setOpen(false), [])

  if (!content) return children

  const toggleFromTouch = () => {
    setOpen(prev => {
      const next = !prev
      if (next) {
        if (dismissOpenTooltip && dismissOpenTooltip !== close) dismissOpenTooltip()
        dismissOpenTooltip = close
      } else if (dismissOpenTooltip === close) {
        dismissOpenTooltip = null
      }
      return next
    })
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger
          asChild
          onPointerDown={e => {
            isTouchRef.current = e.pointerType === 'touch'
            if (!isTouchRef.current) return
            e.preventDefault()
            toggleFromTouch()
          }}
          onFocus={e => {
            if (isTouchRef.current) e.preventDefault()
          }}
          onClick={e => {
            if (isTouchRef.current) e.preventDefault()
          }}
        >
          {children}
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

'use client'

import React from 'react'
import Link from 'next/link'
import { cn } from '../../utils/cn'
import { Ellipsis01Icon } from '../icons-v2-generated'
import { Button } from './button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from './dropdown-menu'

export type MoreActionsItem = {
  label: string
  /** Click handler. Optional when `href` is provided. */
  onClick?: () => void
  /** If set, the item renders as a Next.js Link (real <a href> in the DOM). */
  href?: string
  /** Only relevant with `href` — opens the link in a new tab. */
  openInNewTab?: boolean
  icon?: React.ReactNode
  disabled?: boolean
  danger?: boolean
}

export interface MoreActionsMenuProps {
  items: MoreActionsItem[]
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
  className?: string
  ariaLabel?: string
  /** Custom trigger element. When provided, replaces the default ellipsis icon button. */
  trigger?: React.ReactNode
  /** Controlled open state. */
  open?: boolean
  /** Called when the open state changes — use together with `open`. */
  onOpenChange?: (open: boolean) => void
}

/**
 * Compact, reusable menu triggered by an ellipsis icon button.
 * Built on top of Radix DropdownMenu used in the UI Kit.
 */
export function MoreActionsMenu({
  items,
  align = 'end',
  side = 'bottom',
  sideOffset = 6,
  className,
  ariaLabel = 'More actions',
  trigger,
  open,
  onOpenChange
}: MoreActionsMenuProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            size="icon"
            className={className || 'bg-ods-card border-ods-border hover:bg-ods-bg-hover flex items-center justify-center'}
            aria-label={ariaLabel}
          >
            <Ellipsis01Icon size={24} className="text-ods-text-primary" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        side={side}
        sideOffset={sideOffset}
        className="bg-ods-card border border-ods-border p-0 rounded-[4px] min-w-[200px]"
      >
        {items.map((item, idx) => {
          const itemClassName =
            'flex items-center gap-2 px-4 py-3 bg-ods-bg hover:bg-ods-bg-hover focus:bg-ods-bg-hover border-b border-ods-border last:border-b-0 rounded-none cursor-pointer data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed'

          const content = (
            <>
              {item.icon && (
                <div className={cn(item.danger ? 'text-ods-error' : 'text-ods-text-secondary', '[&_svg]:size-6 [&_svg]:shrink-0')}>
                  {item.icon}
                </div>
              )}
              <span className="font-medium text-[18px] leading-6 text-ods-text-primary">
                {item.label}
              </span>
            </>
          )

          const handleActivate = (e: React.SyntheticEvent) => {
            e.stopPropagation()
            if (!item.disabled) item.onClick?.()
          }

          // Link variant — real <a href> in the DOM, visible to crawlers
          if (item.href) {
            return (
              <DropdownMenuItem
                key={`${item.label}-${idx}`}
                asChild
                disabled={item.disabled}
                className={itemClassName}
              >
                <Link
                  href={item.href}
                  target={item.openInNewTab ? '_blank' : undefined}
                  rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                  aria-disabled={item.disabled || undefined}
                  tabIndex={item.disabled ? -1 : undefined}
                  onClick={(e) => {
                    if (item.disabled) {
                      e.preventDefault()
                      e.stopPropagation()
                      return
                    }
                    if (item.onClick) handleActivate(e)
                  }}
                >
                  {content}
                </Link>
              </DropdownMenuItem>
            )
          }

          // Button variant — onClick only
          return (
            <DropdownMenuItem
              key={`${item.label}-${idx}`}
              onClick={handleActivate}
              disabled={item.disabled}
              className={itemClassName}
            >
              {content}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}



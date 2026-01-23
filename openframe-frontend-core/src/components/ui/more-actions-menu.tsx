'use client'

import React from 'react'
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
  onClick: () => void
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
  ariaLabel = 'More actions'
}: MoreActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={className || 'bg-ods-card border-ods-border hover:bg-ods-bg-hover flex items-center justify-center'}
          aria-label={ariaLabel}
        >
          <Ellipsis01Icon size={24} className="text-text-primary" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        side={side}
        sideOffset={sideOffset}
        className="bg-ods-card border border-ods-border p-0 rounded-[4px] min-w-[200px]"
      >
        {items.map((item, idx) => {
          return (
            <DropdownMenuItem
              key={`${item.label}-${idx}`}
              onClick={(e) => {
                e.stopPropagation()
                if (!item.disabled) item.onClick()
              }}
              disabled={item.disabled}
              className="flex items-center gap-2 px-4 py-3 bg-ods-bg hover:bg-ods-bg-hover focus:bg-ods-bg-hover border-b border-ods-border last:border-b-0 rounded-none cursor-pointer data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
            >
              {item.icon && 
                <div className={cn(item.danger ? 'text-ods-error' : 'text-ods-text-secondary', '[&_svg]:size-6 [&_svg]:shrink-0')}>{item.icon}</div>
              }
              <span className={`font-medium text-[18px] leading-6 ${item.danger ? 'text-ods-text-primary' : 'text-ods-text-primary'}`}>
                {item.label}
              </span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}



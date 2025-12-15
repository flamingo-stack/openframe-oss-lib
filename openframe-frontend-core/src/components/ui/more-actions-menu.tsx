'use client'

import React from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Button } from './button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
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
          className={className || 'bg-[#212121] border-[#3a3a3a] hover:bg-[#2a2a2a] h-12 w-12'}
          aria-label={ariaLabel}
        >
          <MoreHorizontal className="h-6 w-6 text-[#fafafa]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        side={side}
        sideOffset={sideOffset}
        className="bg-ods-card border border-ods-border p-0"
      >
        {items.map((item, idx) => {
          const content = (
            <div className="flex items-center justify-start gap-2 w-full">
              {item.icon}
              <span className={`font-['DM_Sans'] text-[18px] ${item.danger ? 'text-error' : ''}`}>{item.label}</span>
            </div>
          )
          return (
            <DropdownMenuItem
              key={`${item.label}-${idx}`}
              onClick={(e) => {
                e.stopPropagation()
                if (!item.disabled) item.onClick()
              }}
              disabled={item.disabled}
              className="focus:bg-ods-bg-hover justify-start text-left px-4 py-3 rounded-none"
            >
              {content}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}



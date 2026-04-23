'use client'

import React from 'react'
import { cn } from '../../utils/cn'
import { Chevron02DownIcon } from '../icons-v2-generated'
import { MoreActionsMenu, type MoreActionsItem } from './more-actions-menu'

export interface DropdownButtonProps {
  /** Button label rendered next to the chevron. */
  label: string
  /** Optional leading icon rendered before the label. */
  icon?: React.ReactNode
  /** Items shown in the dropdown. */
  items: MoreActionsItem[]
  disabled?: boolean
  className?: string
  ariaLabel?: string
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
}

/**
 * A card-colored trigger button that opens a dropdown of actions. The button
 * has a visual seam between the label and the trailing chevron, but the
 * entire surface is a single click target. The wrapper lightens on hover and
 * while the dropdown is open; the chevron rotates 180° to point up when open.
 *
 * Used standalone or via `PageActions` when a `PageActionButton` has
 * `dropdownItems` set.
 */
export function DropdownButton({
  label,
  icon,
  items,
  disabled,
  className,
  ariaLabel,
  align = 'end',
  side = 'bottom'
}: DropdownButtonProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <MoreActionsMenu
      items={items}
      open={open}
      onOpenChange={setOpen}
      align={align}
      side={side}
      ariaLabel={ariaLabel || label}
      trigger={
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel || label}
          className={cn(
            'inline-flex h-12 items-stretch rounded-md border border-ods-border overflow-hidden transition-colors',
            'text-ods-text-primary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus',
            open ? 'bg-ods-bg-hover' : 'bg-ods-card',
            !disabled && !open && 'hover:bg-ods-bg-hover',
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
        >
          <span className="flex items-center gap-[var(--spacing-system-xsf)] px-[var(--spacing-system-m)] py-[var(--spacing-system-sf)] text-h3">
            {icon && (
              <span className="flex items-center justify-center [&_svg]:w-6 [&_svg]:h-6">
                {icon}
              </span>
            )}
            <span className="whitespace-nowrap">{label}</span>
          </span>
          <span className="flex items-center justify-center border-l border-ods-border p-[var(--spacing-system-sf)] [&_svg]:w-6 [&_svg]:h-6">
            <Chevron02DownIcon
              className={cn('transition-transform duration-fast', open && 'rotate-180')}
            />
          </span>
        </button>
      }
    />
  )
}

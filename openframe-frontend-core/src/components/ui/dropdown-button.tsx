'use client'

import React from 'react'
import { cn } from '../../utils/cn'
import { Chevron02DownIcon } from '../icons-v2-generated'
import { Button, type ButtonProps } from './button'
import {
  ActionsMenuDropdown,
  type ActionsMenuGroup,
  type ActionsMenuItem
} from './actions-menu'

export interface DropdownButtonProps {
  /** Button label rendered next to the chevron. */
  label: React.ReactNode
  /** Optional leading icon rendered before the label. */
  icon?: React.ReactNode
  /**
   * Items shown in the dropdown (single flat group). For grouped menus with
   * separators pass `groups` instead — exactly one of the two is required.
   */
  items?: ActionsMenuItem[]
  /** Grouped items (with optional separators). Takes precedence over `items`. */
  groups?: ActionsMenuGroup[]
  /**
   * Render the trigger as a standard `Button` of this variant (`outline`,
   * `accent`, …) instead of the default card-colored seam trigger. Use this
   * when the dropdown sits in a row of ordinary buttons and must match them.
   */
  variant?: ButtonProps['variant']
  /** Button size for the `variant` trigger. Ignored without `variant`. */
  size?: ButtonProps['size']
  /** Spinner state for the `variant` trigger. Ignored without `variant`. */
  loading?: boolean
  disabled?: boolean
  className?: string
  ariaLabel?: string
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  /**
   * Forwarded to the dropdown content. The standard Radix dropdown→dialog
   * recipe: pass `(e) => e.preventDefault()` when a menu item opens a modal,
   * otherwise closing the menu refocuses its trigger AFTER the dialog has
   * taken focus, yanking focus back OUT of the modal the action just opened.
   */
  onCloseAutoFocus?: (event: Event) => void
}

/**
 * THE multi-action button — a labeled trigger with a chevron opening an
 * `ActionsMenu`. One component, so the trigger styling, chevron, and menu
 * chrome cannot drift between surfaces.
 *
 * Two trigger looks:
 * - default (no `variant`): the card-colored seam trigger — label and chevron
 *   separated by a divider, whole surface one click target, chevron rotates
 *   while open. Used standalone or via `PageActions` when a `PageActionButton`
 *   has `dropdownItems` set.
 * - `variant="outline"` (or any Button variant): a standard `Button` with the
 *   chevron as its right icon, so the trigger matches sibling buttons in the
 *   same row — including `loading` and `leftIcon` support.
 *
 * Item clicks close the menu (ActionsMenuDropdown's default; opt out per item
 * with `closeOnSelect: false`).
 */
export function DropdownButton({
  label,
  icon,
  items,
  groups,
  variant,
  size = 'small-legacy',
  loading = false,
  disabled,
  className,
  ariaLabel,
  align = 'end',
  side = 'bottom',
  onCloseAutoFocus
}: DropdownButtonProps) {
  const [open, setOpen] = React.useState(false)

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (disabled || loading) return
      setOpen(next)
    },
    [disabled, loading]
  )

  const resolvedAriaLabel =
    ariaLabel || (typeof label === 'string' ? label : undefined)

  const trigger = variant ? (
    <Button
      variant={variant}
      size={size}
      disabled={disabled}
      loading={loading}
      aria-label={resolvedAriaLabel}
      leftIcon={icon}
      rightIcon={
        <Chevron02DownIcon
          className={cn('h-4 w-4 transition-transform duration-fast', open && 'rotate-180')}
        />
      }
      className={className}
    >
      {label}
    </Button>
  ) : (
    <button
      type="button"
      disabled={disabled}
      aria-label={resolvedAriaLabel}
      onPointerDown={disabled ? (e) => e.preventDefault() : undefined}
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
  )

  return (
    <ActionsMenuDropdown
      groups={groups ?? [{ items: items ?? [] }]}
      open={open}
      onOpenChange={handleOpenChange}
      align={align}
      side={side}
      onCloseAutoFocus={onCloseAutoFocus}
      triggerAriaLabel={resolvedAriaLabel}
      customTrigger={trigger}
    />
  )
}

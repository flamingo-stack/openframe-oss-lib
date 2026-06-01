'use client'

import React from 'react'
import { cn } from '../../utils/cn'
import { MingoIcon } from '../icons'

export interface HeaderMingoButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Active/pressed state — set to `true` while the Mingo drawer is open. */
  isActive?: boolean
  /** When true, hides the "Mingo AI" label and renders only the icon (so the
   *  control collapses to a square `HeaderButton`-sized affordance on narrow
   *  viewports). Defaults to `false`. */
  iconOnly?: boolean
  className?: string
}

/**
 * "Mingo AI" launcher button for `AppHeader`. Mirrors the `HeaderButton`
 * visual contract (sticky header height, `ods-card` rest / `ods-bg-hover`
 * hover / `ods-bg-active` active, divider via `AppHeader`'s `divide-x`), but
 * carries both the Mingo logo and the bold "Mingo AI" wordmark.
 *
 * Figma: 7532:222103 — `button-full`.
 */
export function HeaderMingoButton({
  isActive = false,
  iconOnly = false,
  className,
  ...props
}: HeaderMingoButtonProps) {
  return (
    <button
      type="button"
      aria-label="Mingo AI"
      aria-pressed={isActive}
      className={cn(
        'flex items-center shrink-0 h-full gap-2 px-4',
        'transition-colors duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent',
        isActive
          ? 'text-ods-text-primary bg-ods-bg-active'
          : 'text-ods-text-primary bg-ods-card hover:bg-ods-bg-hover',
        className,
      )}
      {...props}
    >
      <MingoIcon className="w-6 h-6 shrink-0" />
      {!iconOnly && (
        <span className="text-h3 font-bold tracking-[-0.36px] whitespace-nowrap">
          Mingo AI
        </span>
      )}
    </button>
  )
}

export default HeaderMingoButton

'use client'

import React from 'react'
import { cn } from '../../utils/cn'

export interface HeaderButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Whether the button is in active/pressed state */
  isActive?: boolean
  /** Icon to display in the button */
  icon: React.ReactNode
  /** Additional class names */
  className?: string
}

export function HeaderButton({
  isActive = false,
  icon,
  className,
  ...props
}: HeaderButtonProps) {
  return (
    <button
      className={cn(
        "flex items-center justify-center shrink-0",
        "transition-colors duration-200",
        // Square cell width follows the TopNavigation size (56px small /
        // 72px big) via the shell's --top-nav-cell var; 56px fallback for
        // standalone use.
        "w-[var(--top-nav-cell,3.5rem)] h-full",
        isActive
          ? "text-ods-text-primary bg-ods-bg-active"
          : // Transparent at rest so the cell inherits the bar's background
            // (TopNavigation `backgroundClassName` can differ per platform).
            "text-ods-text-secondary bg-transparent hover:bg-ods-bg-hover",
        className
      )}
      {...props}
    >
      {icon}
    </button>
  )
}

export default HeaderButton

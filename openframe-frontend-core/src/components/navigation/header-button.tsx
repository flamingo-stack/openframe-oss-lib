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
        "w-12 h-full md:w-14",
        isActive
          ? "text-ods-text-primary bg-ods-bg-active"
          : "text-ods-text-secondary bg-ods-card hover:bg-ods-bg-hover",
        className
      )}
      {...props}
    >
      {icon}
    </button>
  )
}

export default HeaderButton

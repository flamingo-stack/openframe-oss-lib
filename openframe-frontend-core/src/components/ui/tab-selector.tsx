'use client'

import React from 'react'
import { cn } from '../../utils/cn'

export interface TabSelectorItem {
  /** Unique identifier for the tab */
  id: string
  /** Display label */
  label: string
  /** Optional icon (ReactNode) displayed before the label */
  icon?: React.ReactNode
  /** Whether this tab is disabled */
  disabled?: boolean
  /** Optional badge element displayed after the label */
  badge?: React.ReactNode
}

export interface TabSelectorProps {
  /** Currently selected tab id */
  value: string
  /** Callback when tab selection changes */
  onValueChange: (value: string) => void
  /** Tab items to display */
  items: TabSelectorItem[]
  /** Visual variant: primary (accent bg) or secondary (soft grey bg) */
  variant?: 'primary' | 'secondary'
  /** Optional label displayed above the selector */
  label?: string
  /** Additional CSS classes for the root container */
  className?: string
}

export function TabSelector({
  value,
  onValueChange,
  items,
  variant = 'primary',
  label,
  className,
}: TabSelectorProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <p className="text-ods-text-primary text-h3">
          {label}
        </p>
      )}
      <div className="flex w-full bg-ods-bg border border-ods-border rounded-md p-1 gap-1 h-12">
        {items.map((item) => {
          const isActive = value === item.id
          const isDisabled = item.disabled

          return (
            <button
              key={item.id}
              type="button"
              disabled={isDisabled}
              onClick={() => onValueChange(item.id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-xs p-2 text-h4 transition-colors duration-200 whitespace-nowrap',
                isDisabled
                  ? 'opacity-50 cursor-not-allowed bg-transparent text-ods-text-secondary'
                  : isActive
                    ? variant === 'primary'
                      ? 'bg-ods-accent text-ods-text-on-accent cursor-default [font-weight:700]'
                      : 'bg-ods-bg-surface text-ods-text-primary cursor-default [font-weight:700]'
                    : 'bg-transparent text-ods-text-primary hover:bg-ods-bg-hover cursor-pointer',
              )}
            >
              {item.icon && (
                <span className="shrink-0 size-6 flex items-center justify-center">
                  {item.icon}
                </span>
              )}
              {item.label}
              {item.badge && item.badge}
            </button>
          )
        })}
      </div>
    </div>
  )
}

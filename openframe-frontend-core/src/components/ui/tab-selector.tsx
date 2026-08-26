'use client'

import React from 'react'
import { Label } from './label'
import { cn } from '../../utils/cn'

export interface TabSelectorItem {
  /** Unique identifier for the tab */
  id: string
  /** Display label. Optional — omit for icon-only tabs (provide `ariaLabel` for accessibility). */
  label?: string
  /** Accessible name. Required when `label` is omitted. */
  ariaLabel?: string
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
  /** Disable the entire selector (overrides per-item enabled state) */
  disabled?: boolean
  /**
   * Horizontal-scroll mode for unbounded/dynamic tab sets (e.g. data-derived
   * purposes). The default layout divides the row width equally (`flex-1`
   * items in a `w-full` row). Use `scrollable` when labels may exceed the
   * available width; it sizes tabs to their labels (`flex-none`) and lets
   * the row scroll (`overflow-x-auto`).
   */
  scrollable?: boolean
  /** Additional CSS classes for the root container */
  className?: string
}

export function TabSelector({
  value,
  onValueChange,
  items,
  variant = 'primary',
  label,
  disabled,
  scrollable = false,
  className,
}: TabSelectorProps) {
  return (
    <div
      className={cn('flex flex-col gap-[var(--spacing-system-xxs)]', disabled && 'opacity-50', className)}
      aria-disabled={disabled || undefined}
    >
      {label && (
        // Label for family/color; "large" (text-h4) is this component's
        // long-standing label scale — neighbours opt into the same scale via
        // their `labelVariant="large"` when a design puts them side by side.
        <Label variant="large">
          {label}
        </Label>
      )}
      <div
        className={cn(
          'flex bg-ods-bg border border-ods-border rounded-md p-[var(--spacing-system-xxs)] gap-[var(--spacing-system-xxs)] h-11 md:h-12',
          scrollable ? 'overflow-x-auto' : 'w-full',
        )}
      >
        {items.map((item) => {
          const isActive = value === item.id
          const isDisabled = disabled || item.disabled

          return (
            <button
              key={item.id}
              type="button"
              disabled={isDisabled}
              onClick={() => onValueChange(item.id)}
              aria-label={!item.label ? item.ariaLabel : undefined}
              className={cn(
                // Bold on BOTH states (text-h3 = DM Sans bold) — a medium↔bold
                // flip between the active and inactive tabs read as inconsistent
                // weight (and nudged label widths on every switch).
                'flex items-center justify-center gap-[var(--spacing-system-xs)] rounded-xs p-[var(--spacing-system-xsf)] text-h4 transition-colors duration-200 whitespace-nowrap',
                // scrollable: intrinsic widths must sum past the container or
                // nothing ever overflows (flex-1's basis-0 defeats the scroll).
                scrollable ? 'flex-none basis-auto shrink-0' : 'flex-1',
                isDisabled
                  ? isActive
                    ? 'cursor-not-allowed bg-ods-bg-surface text-ods-text-secondary'
                    : 'cursor-not-allowed bg-transparent text-ods-text-secondary'
                  : isActive
                    ? variant === 'primary'
                      ? 'bg-ods-accent text-ods-text-on-accent cursor-default'
                      : 'bg-ods-bg-surface text-ods-text-primary cursor-default'
                    : 'bg-transparent text-ods-text-primary hover:bg-ods-bg-hover cursor-pointer',
              )}
            >
              {item.icon && (
                <span className="shrink-0 size-4 md:size-6 flex items-center justify-center">
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

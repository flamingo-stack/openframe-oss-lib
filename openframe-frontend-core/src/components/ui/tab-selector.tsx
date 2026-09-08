'use client';

import type React from 'react';
import { cn } from '../../utils/cn';
import { useIsInActionsMenuHeader } from './actions-menu-header-context';
import { Label } from './label';

export interface TabSelectorItem {
  /** Unique identifier for the tab */
  id: string;
  /** Display label. Optional — omit for icon-only tabs (provide `ariaLabel` for accessibility). */
  label?: string;
  /** Accessible name. Required when `label` is omitted. */
  ariaLabel?: string;
  /** Optional icon (ReactNode) displayed before the label */
  icon?: React.ReactNode;
  /** Whether this tab is disabled */
  disabled?: boolean;
  /** Optional badge element displayed after the label */
  badge?: React.ReactNode;
}

export interface TabSelectorProps {
  /** Currently selected tab id */
  value: string;
  /** Callback when tab selection changes */
  onValueChange: (value: string) => void;
  /** Tab items to display */
  items: TabSelectorItem[];
  /** Visual variant: primary (accent bg) or secondary (soft grey bg) */
  variant?: 'primary' | 'secondary';
  /** Optional label displayed above the selector */
  label?: string;
  /** Disable the entire selector (overrides per-item enabled state) */
  disabled?: boolean;
  /**
   * Horizontal-scroll mode for unbounded/dynamic tab sets (e.g. data-derived
   * purposes). The default layout divides the row width equally (`flex-1`
   * items in a `w-full` row). Use `scrollable` when labels may exceed the
   * available width; it sizes tabs to their labels (`flex-none`) and lets
   * the row scroll (`overflow-x-auto`).
   */
  scrollable?: boolean;
  /** Additional CSS classes for the root container */
  className?: string;
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
  // Inside an ActionsMenu header row the selector renders FLUSH - no border,
  // no row rounding (the menu's row border and rounding are the frame) and a
  // fixed 40px height, while the inner 4px padding, the segment gap and the
  // segment radius stay, per the mobile "..." menu mock. The same node a page
  // renders in its title bar adapts by context, with no re-styling at the
  // call site.
  const flush = useIsInActionsMenuHeader();
  return (
    <div
      className={cn('flex flex-col gap-[var(--spacing-system-xxs)]', disabled && 'opacity-50', className)}
      aria-disabled={disabled || undefined}
    >
      {label && (
        // Label for family/color; 'large' (text-h4) is this component's
        // long-standing label scale — neighbours opt into the same scale via
        // their `labelVariant="large"` when a design puts them side by side.
        <Label variant="large">{label}</Label>
      )}
      <div
        className={cn(
          'flex gap-[var(--spacing-system-xxs)] bg-ods-bg p-[var(--spacing-system-xxs)]',
          flush
            ? 'h-10 w-full'
            : cn('h-11 rounded-md border border-ods-border md:h-12', scrollable ? 'overflow-x-auto' : 'w-full'),
        )}
      >
        {items.map(item => {
          const isActive = value === item.id;
          const isDisabled = disabled || item.disabled;

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
                'flex items-center justify-center gap-[var(--spacing-system-xs)] whitespace-nowrap rounded-xs p-[var(--spacing-system-xsf)] transition-colors duration-200 text-h4',
                // scrollable: intrinsic widths must sum past the container or
                // nothing ever overflows (flex-1's basis-0 defeats the scroll).
                scrollable ? 'flex-none shrink-0 basis-auto' : 'flex-1',
                isDisabled
                  ? isActive
                    ? 'cursor-not-allowed bg-ods-bg-surface text-ods-text-secondary'
                    : 'cursor-not-allowed bg-transparent text-ods-text-secondary'
                  : isActive
                    ? variant === 'primary'
                      ? 'cursor-default bg-ods-accent text-ods-text-on-accent'
                      : 'cursor-default bg-ods-bg-surface text-ods-text-primary'
                    : 'cursor-pointer bg-transparent text-ods-text-primary hover:bg-ods-bg-hover',
              )}
            >
              {item.icon && (
                <span className="flex size-4 shrink-0 items-center justify-center md:size-6">{item.icon}</span>
              )}
              {item.label}
              {item.badge && item.badge}
            </button>
          );
        })}
      </div>
    </div>
  );
}

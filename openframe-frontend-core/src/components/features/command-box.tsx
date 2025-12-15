'use client'

import React from 'react'
import { Button } from '../ui/button'
import { cn } from '../../utils/cn'

export interface CommandBoxAction {
  /** Button label */
  label: string
  /** Click handler */
  onClick: () => void
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  /** Icon to display before the label */
  icon?: React.ReactNode
  /** Whether the button is disabled */
  disabled?: boolean
  /** Whether the button is in loading state */
  loading?: boolean
}

export interface CommandBoxProps {
  /** The command text to display */
  command: string
  /** Title displayed above the command box */
  title?: string
  /** Primary action button (displayed on the right) */
  primaryAction?: CommandBoxAction
  /** Secondary action button (displayed before primary) */
  secondaryAction?: CommandBoxAction
  /** Additional CSS classes for the container */
  className?: string
  /** Additional CSS classes for the command text */
  commandClassName?: string
  /** Maximum lines to show (uses line-clamp, 0 for unlimited) */
  maxLines?: number
}

/**
 * CommandBox - Unified component for displaying commands with action buttons
 *
 * Features:
 * - Displays command text in monospace font
 * - Optional title
 * - Primary and secondary action buttons
 * - Configurable line clamping
 * - Consistent ODS styling
 *
 * Usage Example:
 * ```tsx
 * import { CommandBox } from '@flamingo/ui-kit/components/features'
 * import { Copy, Play } from 'lucide-react'
 *
 * <CommandBox
 *   title="Device Add Command"
 *   command="curl -L https://example.com/install.sh | bash"
 *   primaryAction={{
 *     label: 'Copy Command',
 *     onClick: handleCopy,
 *     icon: <Copy className="w-5 h-5" />,
 *     variant: 'primary'
 *   }}
 *   secondaryAction={{
 *     label: 'Run on Current Machine',
 *     onClick: handleRun,
 *     icon: <Play className="w-5 h-5" />,
 *     variant: 'outline'
 *   }}
 * />
 * ```
 */
// Static mapping for line-clamp classes (Tailwind needs static class names at build time)
const lineClampClasses: Record<number, string> = {
  1: 'line-clamp-1',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  5: 'line-clamp-5',
  6: 'line-clamp-6',
}

export function CommandBox({
  command,
  title,
  primaryAction,
  secondaryAction,
  className,
  commandClassName,
  maxLines = 0
}: CommandBoxProps) {
  // Get static line-clamp class or undefined for unlimited
  const lineClampClass = maxLines > 0 ? lineClampClasses[maxLines] : undefined

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {title && (
        <div className="text-ods-text-primary text-[18px] font-medium">
          {title}
        </div>
      )}
      <div className="bg-ods-card border border-ods-border rounded-[6px] p-4">
        <div
          className={cn(
            'text-ods-text-primary font-mono text-[14px] md:text-[16px] leading-relaxed break-all',
            lineClampClass,
            commandClassName
          )}
        >
          {command}
        </div>
        {(primaryAction || secondaryAction) && (
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end mt-4">
            {secondaryAction && (
              <Button
                variant={secondaryAction.variant || 'outline'}
                leftIcon={secondaryAction.icon}
                onClick={secondaryAction.onClick}
                disabled={secondaryAction.disabled}
                loading={secondaryAction.loading}
                className="w-full sm:w-auto"
              >
                {secondaryAction.label}
              </Button>
            )}
            {primaryAction && (
              <Button
                variant={primaryAction.variant || 'primary'}
                leftIcon={primaryAction.icon}
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                loading={primaryAction.loading}
                className="w-full sm:w-auto"
              >
                {primaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

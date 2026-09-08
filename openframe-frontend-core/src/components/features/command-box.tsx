'use client';

import type React from 'react';
import { cn } from '../../utils/cn';
import { Copy02Icon } from '../icons-v2-generated/documents/copy-02-icon';
import { Button } from '../ui/button';

export interface CommandBoxAction {
  /** Button label */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Button variant */
  variant?: 'accent' | 'outline' | 'transparent' | 'destructive';
  /** Icon to display before the label */
  icon?: React.ReactNode;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Whether the button is in loading state */
  loading?: boolean;
}

export interface CommandBoxProps {
  /** The command text to display */
  command: string;
  /** Title displayed above the command box */
  title?: string;
  /** Primary action button (displayed on the right) */
  primaryAction?: CommandBoxAction;
  /** Secondary action button (displayed before primary) */
  secondaryAction?: CommandBoxAction;
  /** Additional CSS classes for the container */
  className?: string;
  /** Additional CSS classes for the command text */
  commandClassName?: string;
  /** Maximum lines to show (uses line-clamp, 0 for unlimited) */
  maxLines?: number;
  /** When set, shows a copy icon button in the top-right corner of the box */
  onCopy?: () => void;
  /** Accessible label for the corner copy button */
  copyAriaLabel?: string;
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
};

export function CommandBox({
  command,
  title,
  primaryAction,
  secondaryAction,
  className,
  commandClassName,
  maxLines = 0,
  onCopy,
  copyAriaLabel = 'Copy command',
}: CommandBoxProps) {
  // Get static line-clamp class or undefined for unlimited
  const lineClampClass = maxLines > 0 ? lineClampClasses[maxLines] : undefined;

  const commandText = (
    <div
      className={cn(
        'break-all text-ods-text-primary text-code',
        onCopy && 'min-w-0 flex-1',
        lineClampClass,
        commandClassName,
      )}
    >
      {command}
    </div>
  );

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {title && <div className="text-ods-text-primary text-h4">{title}</div>}
      <div className="rounded-[6px] border border-ods-border bg-ods-bg p-4">
        {onCopy ? (
          <div className="flex items-start gap-4">
            {commandText}
            <button
              type="button"
              onClick={onCopy}
              aria-label={copyAriaLabel}
              className="shrink-0 rounded-md text-ods-text-secondary transition-colors hover:text-ods-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus"
            >
              <Copy02Icon className="h-5 w-5" />
            </button>
          </div>
        ) : (
          commandText
        )}
        {(primaryAction || secondaryAction) && (
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:justify-end">
            {secondaryAction && (
              <Button
                variant={secondaryAction.variant || 'outline'}
                leftIcon={secondaryAction.icon}
                onClick={secondaryAction.onClick}
                disabled={secondaryAction.disabled}
                loading={secondaryAction.loading}
                className="w-full md:w-auto"
              >
                {secondaryAction.label}
              </Button>
            )}
            {primaryAction && (
              <Button
                variant={primaryAction.variant || 'accent'}
                leftIcon={primaryAction.icon}
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                loading={primaryAction.loading}
                className="w-full md:w-auto"
              >
                {primaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { ChevronDown } from 'lucide-react';
import type React from 'react';
import { cn } from '../../utils/cn';
import { Copy02Icon } from '../icons-v2-generated/documents/copy-02-icon';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { Button } from '../ui/button';
import { FadePreview } from '../ui/fade-preview';
import { useLoadingScope } from '../ui/loading-scope';

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
  /**
   * Fixed height for the command area, in lines of `text-code`. Unlike
   * `maxLines`, the box is this tall whatever the content: every box in a list
   * lines up, and text that changes live (a template being filled in) never
   * moves the layout. Longer text fades out under the shared `FadePreview` with
   * a "Show all" toggle; it NEVER scrolls inside the box, because a nested
   * scroller captures the wheel and stops the page from scrolling under the
   * pointer. Takes precedence over `maxLines`. Nothing is hidden from `onCopy`.
   */
  visibleLines?: number;
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
 * import { CommandBox } from '@flamingo-stack/openframe-frontend-core/components/features'
 * import { Copy02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2-generated/documents/copy-02-icon'
 *
 * <CommandBox
 *   title="Device Add Command"
 *   command="curl -L https://example.com/install.sh | bash"
 *   primaryAction={{
 *     label: 'Copy Command',
 *     onClick: handleCopy,
 *     icon: <Copy02Icon className="w-5 h-5" />,
 *     variant: 'accent'
 *   }}
 *   secondaryAction={{
 *     label: 'Run on Current Machine',
 *     onClick: handleRun,
 *     icon: <Copy02Icon className="w-5 h-5" />,
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

/** The box's layout, read by the box and by its skeleton, so the skeleton is the box's size. */
const COMMAND_BOX_CLASS = 'flex flex-col gap-2';
const COMMAND_BOX_TITLE_CLASS = 'text-ods-text-primary text-h4';
const COMMAND_BOX_FRAME_CLASS = 'rounded-[6px] border border-ods-border bg-ods-bg p-4';
const COMMAND_BOX_COPY_ROW_CLASS = 'flex items-start gap-4';
const COMMAND_BOX_COPY_BUTTON_CLASS =
  'shrink-0 rounded-md text-ods-text-secondary transition-colors hover:text-ods-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus';
const COMMAND_BOX_ACTIONS_CLASS = 'mt-4 flex flex-col gap-3 content-md:flex-row content-md:justify-end';
const COMMAND_BOX_ACTION_CLASS = 'w-full content-md:w-auto';
/** The fixed-height command area: N rows of the `text-code` line height token. Read by the box and its skeleton. */
const fixedCommandHeight = (visibleLines: number) => `calc(${visibleLines} * var(--font-line-space-h6-caption))`;
/** The fixed-height area's toggle wording, read by the box and by its skeleton. */
const COMMAND_TOGGLE_LABELS = { more: 'Show all', less: 'Show less' };
export function CommandBox({
  command,
  title,
  primaryAction,
  secondaryAction,
  className,
  commandClassName,
  maxLines = 0,
  visibleLines,
  onCopy,
  copyAriaLabel = 'Copy command',
}: CommandBoxProps) {
  const fixedHeight = visibleLines !== undefined && visibleLines > 0;
  // While the page is read the command is not known: the box is drawn as its skeleton, as tall as the command.
  if (useLoadingScope()) {
    return (
      <CommandBoxSkeleton
        title={title}
        lines={!fixedHeight && maxLines > 0 ? maxLines : undefined}
        visibleLines={fixedHeight ? visibleLines : undefined}
        primaryActionLabel={primaryAction?.label}
        primaryActionIcon={primaryAction?.icon}
        primaryActionVariant={primaryAction?.variant}
        secondaryActionLabel={secondaryAction?.label}
        secondaryActionIcon={secondaryAction?.icon}
        secondaryActionVariant={secondaryAction?.variant}
        showCopy={Boolean(onCopy)}
        className={className}
      />
    );
  }
  // Get static line-clamp class or undefined for unlimited
  const lineClampClass = !fixedHeight && maxLines > 0 ? lineClampClasses[maxLines] : undefined;

  const text = (
    <div
      className={cn(
        'break-all text-ods-text-primary text-code',
        !fixedHeight && onCopy && 'min-w-0 flex-1',
        lineClampClass,
        commandClassName,
      )}
    >
      {command}
    </div>
  );

  // The height is N rows of the `text-code` line height token, so it follows
  // the responsive type scale instead of a pixel guess.
  const commandText = fixedHeight ? (
    <div className={cn(onCopy && 'min-w-0 flex-1')}>
      {/* No `resetKey`: the text of a live template changes on every keystroke,
          and collapsing on each one would fold an expanded box under the
          typist, the exact jump this mode exists to prevent. Nothing goes stale
          without it: the expanded height is re-measured on every commit. */}
      <FadePreview fixedHeight collapsedHeight={fixedCommandHeight(visibleLines)} labels={COMMAND_TOGGLE_LABELS}>
        {text}
      </FadePreview>
    </div>
  ) : (
    text
  );

  return (
    <div className={cn(COMMAND_BOX_CLASS, className)}>
      {title && <div className={COMMAND_BOX_TITLE_CLASS}>{title}</div>}
      <div className={COMMAND_BOX_FRAME_CLASS}>
        {onCopy ? (
          <div className={COMMAND_BOX_COPY_ROW_CLASS}>
            {commandText}
            <button type="button" onClick={onCopy} aria-label={copyAriaLabel} className={COMMAND_BOX_COPY_BUTTON_CLASS}>
              <Copy02Icon className="h-5 w-5" />
            </button>
          </div>
        ) : (
          commandText
        )}
        {(primaryAction || secondaryAction) && (
          <div className={COMMAND_BOX_ACTIONS_CLASS}>
            {secondaryAction && (
              <Button
                variant={secondaryAction.variant || 'outline'}
                leftIcon={secondaryAction.icon}
                onClick={secondaryAction.onClick}
                disabled={secondaryAction.disabled}
                loading={secondaryAction.loading}
                className={COMMAND_BOX_ACTION_CLASS}
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
                className={COMMAND_BOX_ACTION_CLASS}
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

/**
 * The command box while its command is read: the same box, its title and action buttons for real (their labels are
 * the box's own words), and the command as a bar `lines` lines tall at the command's type step.
 */
export function CommandBoxSkeleton({
  title,
  lines = 2,
  visibleLines,
  primaryActionLabel,
  primaryActionIcon,
  primaryActionVariant,
  secondaryActionLabel,
  secondaryActionIcon,
  secondaryActionVariant,
  showCopy = false,
  className,
}: {
  title?: string;
  lines?: number;
  /** The box's fixed-height mode (`CommandBox` `visibleLines`): that many rows tall, plus the toggle row. */
  visibleLines?: number;
  primaryActionLabel?: string;
  primaryActionIcon?: React.ReactNode;
  primaryActionVariant?: CommandBoxAction['variant'];
  secondaryActionLabel?: string;
  secondaryActionIcon?: React.ReactNode;
  secondaryActionVariant?: CommandBoxAction['variant'];
  /** Draw the corner copy glyph (the box has `onCopy`). */
  showCopy?: boolean;
  className?: string;
}) {
  const commandLines =
    visibleLines !== undefined && visibleLines > 0 ? (
      <div className={cn(showCopy && 'min-w-0 flex-1')}>
        {/* `text-code`'s line height is the token the loaded area's height is N rows of (`fixedCommandHeight`). */}
        <TextLineSkeleton type="code" lines={visibleLines} />
        {/* FadePreview's toggle row, which fixed mode always reserves: the real control, unseen. */}
        <Button
          type="button"
          variant="link"
          size="compact"
          noPaddingX
          tabIndex={-1}
          rightIcon={<ChevronDown />}
          className="invisible mt-[var(--spacing-system-mf)]"
        >
          {COMMAND_TOGGLE_LABELS.more}
        </Button>
      </div>
    ) : (
      <TextLineSkeleton type="code" lines={Math.max(lines, 1)} className={cn(showCopy && 'min-w-0 flex-1')} />
    );
  return (
    <div className={cn(COMMAND_BOX_CLASS, className)} aria-hidden inert>
      {title && <div className={COMMAND_BOX_TITLE_CLASS}>{title}</div>}
      <div className={COMMAND_BOX_FRAME_CLASS}>
        {showCopy ? (
          <div className={COMMAND_BOX_COPY_ROW_CLASS}>
            {commandLines}
            <span className={COMMAND_BOX_COPY_BUTTON_CLASS}>
              <Copy02Icon className="h-5 w-5" />
            </span>
          </div>
        ) : (
          commandLines
        )}
        {(primaryActionLabel || secondaryActionLabel) && (
          <div className={COMMAND_BOX_ACTIONS_CLASS}>
            {secondaryActionLabel && (
              <Button
                variant={secondaryActionVariant || 'outline'}
                leftIcon={secondaryActionIcon}
                className={COMMAND_BOX_ACTION_CLASS}
                tabIndex={-1}
              >
                {secondaryActionLabel}
              </Button>
            )}
            {primaryActionLabel && (
              <Button
                variant={primaryActionVariant || 'accent'}
                leftIcon={primaryActionIcon}
                className={COMMAND_BOX_ACTION_CLASS}
                tabIndex={-1}
              >
                {primaryActionLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

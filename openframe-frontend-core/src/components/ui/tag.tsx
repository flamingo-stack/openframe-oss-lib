'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import { useIsTruncated } from '../../hooks/ui/use-is-truncated';
import { cn } from '../../utils/cn';
import { XmarkCircleIcon } from '../icons-v2-generated/signs-and-symbols/xmark-circle-icon';
import { FloatingTooltip } from './floating-tooltip';

const tagVariants = cva(['inline-flex items-center justify-center rounded-md', 'transition-colors duration-150'], {
  variants: {
    // Chip scale. `default` is the classic 32px mono-uppercase tag; `large`
    // is the Figma "Feature Item" chip (48px, h3 bold body label) used by
    // chip groups acting as tabs (OpenFrame categories).
    size: {
      default: 'h-8 gap-[var(--spacing-system-xs)] p-[var(--spacing-system-xsf)] text-h5',
      large: 'h-12 gap-[var(--spacing-system-xs)] p-[var(--spacing-system-s)] font-bold text-h3',
    },
    variant: {
      primary: ['bg-ods-accent text-ods-text-on-accent', 'hover:bg-ods-accent-hover active:bg-ods-accent-active'],
      outline: [
        'border border-ods-border bg-ods-card text-ods-text-primary',
        'hover:border-ods-border-hover hover:bg-ods-bg-hover',
        'active:border-ods-border-active active:bg-ods-bg-active',
      ],
      success: [
        'bg-ods-success-secondary text-ods-success',
        'hover:bg-ods-success-secondary-hover active:bg-ods-success-secondary-active',
      ],
      warning: [
        'bg-ods-warning-secondary text-ods-warning',
        'hover:bg-ods-warning-secondary-hover active:bg-ods-warning-secondary-active',
      ],
      error: [
        'bg-ods-error-secondary text-ods-error',
        'hover:bg-ods-error-secondary-hover active:bg-ods-error-secondary-active',
      ],
      critical: ['bg-ods-error text-ods-error-secondary', 'hover:bg-ods-error-hover active:bg-ods-error-active'],
      grey: [
        'bg-ods-bg-surface text-ods-text-secondary',
        'hover:bg-ods-bg-surface-hover active:bg-ods-bg-surface-active',
      ],
      // Active/selected chip state (Figma "Feature Item" active): pink
      // border + pink-secondary fill. A dedicated variant (not appended
      // utilities) so its own hover rules win — the outline variant's
      // hover:bg/hover:border would otherwise repaint an active chip grey.
      selected: [
        'border border-ods-flamingo-pink bg-ods-flamingo-pink-secondary text-ods-text-primary',
        'hover:border-ods-flamingo-pink hover:bg-ods-flamingo-pink-secondary-hover',
        'active:bg-ods-flamingo-pink-secondary-active',
      ],
      // Cyan twin of `selected` (Mingo's accent) — same active-chip skin in the
      // cyan theme so agent chip groups can match their own accent.
      selectedCyan: [
        'border border-ods-flamingo-cyan bg-ods-flamingo-cyan-secondary text-ods-text-primary',
        'hover:border-ods-flamingo-cyan hover:bg-ods-flamingo-cyan-secondary-hover',
        'active:bg-ods-flamingo-cyan-secondary-active',
      ],
      // Matches the EntityTagBadges / StatusBadge tag skin (ods-card + ods-border,
      // mono uppercase) so the tag-editor chips render identically to the public
      // tag badges. Used for FilterChipData variant 'tag' (see search-input).
      badge: [
        'border border-ods-border bg-ods-card font-mono uppercase tracking-wide text-ods-text-primary',
        'transition-colors hover:border-ods-accent',
      ],
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'default',
  },
});

const disabledTagClasses = [
  'bg-ods-bg-surface text-ods-text-secondary',
  'border-transparent',
  'cursor-not-allowed',
  'pointer-events-none',
];

export interface TagProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>, VariantProps<typeof tagVariants> {
  label: React.ReactNode;
  labelClassName?: string;
  icon?: React.ReactNode;
  onClose?: () => void;
  disabled?: boolean;
  /**
   * Root element. Defaults to `'div'`. Pass `'span'` to render an INLINE tag
   * that is valid inside phrasing content (e.g. a markdown `<p>` — a block
   * `<div>` there is invalid HTML and breaks hydration). The variant base is
   * already `inline-flex`, so the span lays out identically. Note: `onClose`
   * renders a `<button>`, which is fine inside a `<span>` but not inside an
   * `<a>` — don't combine `as="span"` + `onClose` inside an anchor.
   */
  as?: 'div' | 'span';
}

/**
 * The tag's label slot. String labels get a `FloatingTooltip` with the full
 * value when (and only when) the text is actually clipped — replacing the old
 * native `title`, which showed with the OS delay, unstyled, and even when
 * nothing was truncated. Node labels render exactly as before: the caller owns
 * their content (and any tooltip), so none is added here.
 * The trigger is a `span` so the tag stays valid phrasing content (`as="span"`
 * exists precisely for tags inside a `<p>`).
 */
function TagLabel({ label, labelClassName }: { label: React.ReactNode; labelClassName?: string }) {
  const isString = typeof label === 'string';
  const { ref, isTruncated } = useIsTruncated<HTMLSpanElement>(isString ? label : null);

  if (!isString) {
    return <span className={cn('truncate', labelClassName)}>{label}</span>;
  }

  return (
    <FloatingTooltip
      content={label}
      side="top"
      disabled={!isTruncated}
      as="span"
      triggerClassName="min-w-0 max-w-full"
      className="max-w-xs whitespace-pre-line [overflow-wrap:anywhere]"
    >
      <span ref={ref} className={cn('block truncate', labelClassName)}>
        {label}
      </span>
    </FloatingTooltip>
  );
}

function Tag({
  label,
  variant,
  size,
  icon,
  onClose,
  className,
  labelClassName,
  disabled,
  as: Comp = 'div',
  ...props
}: TagProps) {
  return (
    <Comp
      className={cn(tagVariants({ variant, size }), disabled && disabledTagClasses, className)}
      aria-disabled={disabled || undefined}
      {...props}
    >
      {icon && (
        <span className={cn('flex shrink-0 items-center justify-center', size === 'large' ? 'size-6' : 'size-5')}>
          {icon}
        </span>
      )}
      <TagLabel label={label} labelClassName={labelClassName} />
      {onClose && (
        <button
          type="button"
          disabled={disabled}
          onClick={e => {
            e.stopPropagation();
            onClose();
          }}
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-full opacity-70 transition-opacity',
            disabled ? 'cursor-not-allowed' : 'hover:opacity-100',
          )}
          aria-label="Remove"
        >
          <XmarkCircleIcon className="size-4" />
        </button>
      )}
    </Comp>
  );
}

export { Tag, tagVariants };

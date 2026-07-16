"use client"

import React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { XmarkCircleIcon } from "../icons-v2-generated/signs-and-symbols/xmark-circle-icon"
import { cn } from "../../utils/cn"

const tagVariants = cva(
  [
    "inline-flex items-center justify-center rounded-md",
    "transition-colors duration-150",
  ],
  {
    variants: {
      // Chip scale. `default` is the classic 32px mono-uppercase tag; `large`
      // is the Figma "Feature Item" chip (48px, h3 bold body label) used by
      // chip groups acting as tabs (OpenFrame categories).
      size: {
        default: "text-h5 h-8 gap-[var(--spacing-system-xxs)] p-[var(--spacing-system-xsf)]",
        large: "text-h3 font-bold h-12 gap-[var(--spacing-system-xs)] p-[var(--spacing-system-s)]",
      },
      variant: {
        primary: [
          "bg-ods-accent text-ods-text-on-accent",
          "hover:bg-ods-accent-hover active:bg-ods-accent-active",
        ],
        outline: [
          "bg-ods-card text-ods-text-primary border border-ods-border",
          "hover:bg-ods-bg-hover hover:border-ods-border-hover",
          "active:bg-ods-bg-active active:border-ods-border-active",
        ],
        success: [
          "bg-ods-success-secondary text-ods-success",
          "hover:bg-ods-success-secondary-hover active:bg-ods-success-secondary-active",
        ],
        warning: [
          "bg-ods-warning-secondary text-ods-warning",
          "hover:bg-ods-warning-secondary-hover active:bg-ods-warning-secondary-active",
        ],
        error: [
          "bg-ods-error-secondary text-ods-error",
          "hover:bg-ods-error-secondary-hover active:bg-ods-error-secondary-active",
        ],
        critical: [
          "bg-ods-error text-ods-error-secondary",
          "hover:bg-ods-error-hover active:bg-ods-error-active",
        ],
        grey: [
          "bg-ods-bg-surface text-ods-text-secondary",
          "hover:bg-ods-bg-surface-hover active:bg-ods-bg-surface-active",
        ],
        // Active/selected chip state (Figma "Feature Item" active): pink
        // border + pink-secondary fill. A dedicated variant (not appended
        // utilities) so its own hover rules win — the outline variant's
        // hover:bg/hover:border would otherwise repaint an active chip grey.
        selected: [
          "bg-ods-flamingo-pink-secondary text-ods-text-primary border border-ods-flamingo-pink",
          "hover:bg-ods-flamingo-pink-secondary-hover hover:border-ods-flamingo-pink",
          "active:bg-ods-flamingo-pink-secondary-active",
        ],
        // Cyan twin of `selected` (Mingo's accent) — same active-chip skin in the
        // cyan theme so agent chip groups can match their own accent.
        selectedCyan: [
          "bg-ods-flamingo-cyan-secondary text-ods-text-primary border border-ods-flamingo-cyan",
          "hover:bg-ods-flamingo-cyan-secondary-hover hover:border-ods-flamingo-cyan",
          "active:bg-ods-flamingo-cyan-secondary-active",
        ],
        // Matches the EntityTagBadges / StatusBadge tag skin (ods-card + ods-border,
        // mono uppercase) so the tag-editor chips render identically to the public
        // tag badges. Used for FilterChipData variant 'tag' (see search-input).
        badge: [
          "bg-ods-card text-ods-text-primary border border-ods-border font-mono uppercase tracking-wide",
          "hover:border-ods-accent transition-colors",
        ],
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

const disabledTagClasses = [
  "bg-ods-bg-surface text-ods-text-secondary",
  "border-transparent",
  "cursor-not-allowed",
  "pointer-events-none",
]

export interface TagProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>,
    VariantProps<typeof tagVariants> {
  label: React.ReactNode
  labelClassName?: string
  icon?: React.ReactNode
  onClose?: () => void
  disabled?: boolean
  /**
   * Root element. Defaults to `'div'`. Pass `'span'` to render an INLINE tag
   * that is valid inside phrasing content (e.g. a markdown `<p>` — a block
   * `<div>` there is invalid HTML and breaks hydration). The variant base is
   * already `inline-flex`, so the span lays out identically. Note: `onClose`
   * renders a `<button>`, which is fine inside a `<span>` but not inside an
   * `<a>` — don't combine `as="span"` + `onClose` inside an anchor.
   */
  as?: 'div' | 'span'
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
      className={cn(
        tagVariants({ variant, size }),
        disabled && disabledTagClasses,
        className
      )}
      aria-disabled={disabled || undefined}
      {...props}
    >
      {icon && (
        <span className={cn("flex items-center justify-center shrink-0", size === 'large' ? 'size-6' : 'size-5')}>
          {icon}
        </span>
      )}
      <span className={cn("truncate", labelClassName)} title={typeof label === 'string' ? label : undefined}>{label}</span>
      {onClose && (
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className={cn(
            "flex items-center justify-center size-5 shrink-0 rounded-full opacity-70 transition-opacity",
            disabled ? "cursor-not-allowed" : "hover:opacity-100"
          )}
          aria-label="Remove"
        >
          <XmarkCircleIcon className="size-4" />
        </button>
      )}
    </Comp>
  )
}

export { Tag, tagVariants }

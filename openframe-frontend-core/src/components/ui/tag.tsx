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
          "bg-[var(--ods-open-yellow-base)] text-[var(--ods-system-greys-black)]",
          "hover:bg-[var(--ods-open-yellow-hover)] active:bg-[var(--ods-open-yellow-action)]",
        ],
        outline: [
          "bg-[var(--ods-system-greys-black)] text-[var(--ods-system-greys-white)] border border-[var(--ods-system-greys-soft-grey)]",
          "hover:bg-[var(--ods-system-greys-black-hover)] hover:border-[var(--ods-system-greys-soft-grey-hover)]",
          "active:bg-[var(--ods-system-greys-black-action)] active:border-[var(--ods-system-greys-soft-grey-action)]",
        ],
        success: [
          "bg-[var(--ods-attention-green-success-secondary)] text-[var(--ods-attention-green-success)]",
          "hover:bg-[#385029] active:bg-[#425a33]",
        ],
        warning: [
          "bg-[var(--ods-attention-yellow-warning-secondary)] text-[var(--ods-attention-yellow-warning)]",
          "hover:bg-[#544729] active:bg-[#5e5133]",
        ],
        error: [
          "bg-[var(--ods-attention-red-error-secondary)] text-[var(--ods-attention-red-error)]",
          "hover:bg-[#542b2b] active:bg-[#5e3535]",
        ],
        critical: [
          "bg-[var(--ods-attention-red-error)] text-[var(--ods-attention-red-error-secondary)]",
          "hover:bg-[var(--ods-attention-red-error-hover)] active:bg-[var(--ods-attention-red-error-action)]",
        ],
        grey: [
          "bg-[var(--ods-system-greys-soft-grey)] text-[var(--ods-system-greys-grey)]",
          "hover:bg-[var(--ods-system-greys-soft-grey-hover)] active:bg-[var(--ods-system-greys-soft-grey-action)]",
        ],
        // Active/selected chip state (Figma "Feature Item" active): pink
        // border + pink-secondary fill. A dedicated variant (not appended
        // utilities) so its own hover rules win — the outline variant's
        // hover:bg/hover:border would otherwise repaint an active chip grey.
        selected: [
          "bg-[var(--ods-flamingo-pink-secondary)] text-[var(--ods-system-greys-white)] border border-[var(--ods-flamingo-pink-base)]",
          "hover:bg-[var(--ods-flamingo-pink-secondary-hover)] hover:border-[var(--ods-flamingo-pink-base)]",
          "active:bg-[var(--ods-flamingo-pink-secondary-action)]",
        ],
        // Cyan twin of `selected` (Mingo's accent) — same active-chip skin in the
        // cyan theme so agent chip groups can match their own accent.
        selectedCyan: [
          "bg-[var(--ods-flamingo-cyan-secondary)] text-[var(--ods-system-greys-white)] border border-[var(--ods-flamingo-cyan-base)]",
          "hover:bg-[var(--ods-flamingo-cyan-secondary-hover)] hover:border-[var(--ods-flamingo-cyan-base)]",
          "active:bg-[var(--ods-flamingo-cyan-secondary-action)]",
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
  "bg-[var(--ods-system-greys-soft-grey)] text-[var(--ods-system-greys-grey)]",
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

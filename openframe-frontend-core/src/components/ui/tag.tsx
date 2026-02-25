"use client"

import React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { XmarkCircleIcon } from "../icons-v2-generated/signs-and-symbols/xmark-circle-icon"
import { cn } from "../../utils/cn"

const tagVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 h-8 px-2 rounded-[6px]",
    "font-mono font-medium text-sm leading-5 tracking-[-0.28px] uppercase",
    "transition-colors duration-150",
  ],
  {
    variants: {
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
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  }
)

export interface TagProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>,
    VariantProps<typeof tagVariants> {
  label: React.ReactNode
  labelClassName?: string
  icon?: React.ReactNode
  onClose?: () => void
}

function Tag({
  label,
  variant,
  icon,
  onClose,
  className,
  labelClassName,
  ...props
}: TagProps) {
  return (
    <div
      className={cn(tagVariants({ variant }), className)}
      {...props}
    >
      {icon && (
        <span className="flex items-center justify-center size-5 shrink-0">
          {icon}
        </span>
      )}
      <span className={cn("shrink-0", labelClassName)}>{label}</span>
      {onClose && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="flex items-center justify-center size-5 shrink-0 rounded-full opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Remove"
        >
          <XmarkCircleIcon className="size-4" />
        </button>
      )}
    </div>
  )
}

export { Tag, tagVariants }

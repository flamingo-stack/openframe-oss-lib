"use client"

import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import Link from "next/link"
import React from "react"

import { cn } from "../../utils/cn"

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-[var(--spacing-system-xsf)]",
    "rounded-md whitespace-nowrap",
    "transition-colors duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus",
    "disabled:pointer-events-none",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:h-5 [&_svg]:w-5",
  ],
  {
    variants: {
      variant: {
        accent:
          "bg-ods-accent text-ods-text-on-accent hover:bg-ods-accent-hover active:bg-ods-accent-active disabled:bg-ods-disabled disabled:text-ods-text-secondary",
        outline:
          "border border-ods-border bg-ods-card text-ods-text-primary hover:bg-ods-bg-hover hover:border-ods-border-hover active:bg-ods-bg-active active:border-ods-border-active disabled:bg-ods-card disabled:border-ods-border disabled:text-ods-text-disabled",
        transparent:
          "bg-transparent text-ods-text-primary hover:bg-ods-bg-hover active:bg-ods-bg-active disabled:bg-transparent disabled:text-ods-text-disabled",
        destructive:
          "bg-ods-error text-ods-text-on-accent hover:bg-ods-error-hover active:bg-ods-error-active disabled:bg-ods-disabled disabled:text-ods-text-secondary",
      },
      size: {
        default: "py-[var(--spacing-system-sf)] px-[var(--spacing-system-m)] text-h3 h-12",
        small: "p-[var(--spacing-system-xs)] text-h5 h-6 md:h-8",
        "small-legacy": "py-[var(--spacing-system-xs)] px-[var(--spacing-system-m)] h-10 text-[14px] font-bold", // Temporary alias for "small" to avoid breaking changes in AnnouncementBar's CTA button; will be removed in the future
        icon: "p-[var(--spacing-system-sf)] h-11 w-11 md:h-12 md:w-12 [&_svg]:h-4 [&_svg]:w-4 md:[&_svg]:h-6 md:[&_svg]:w-6",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
      noPaddingX: {
        true: "px-0",
        false: "",
      },
    },
    compoundVariants: [
      { size: "small", class: "[&_svg]:h-4 [&_svg]:w-4" },
    ],
    defaultVariants: {
      variant: "accent",
      size: "default",
      fullWidth: false,
      noPaddingX: false,
    },
  }
)

/** @deprecated Use `size="small"` instead. Temporary alias kept for backward compatibility; will be removed in the future. */
type DeprecatedButtonSize = "small-legacy"

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    Omit<VariantProps<typeof buttonVariants>, "size"> {
  asChild?: boolean
  href?: string
  openInNewTab?: boolean
  prefetch?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  loading?: boolean
  size?: Exclude<VariantProps<typeof buttonVariants>["size"], "small-legacy"> | DeprecatedButtonSize
}

const Spinner = () => (
  <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
)

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    fullWidth,
    noPaddingX,
    asChild,
    href,
    openInNewTab,
    prefetch,
    leftIcon,
    rightIcon,
    loading,
    children,
    disabled,
    onClick,
    ...props
  },
  ref,
) {
  const isDisabled = disabled || loading
  const classes = cn(buttonVariants({ variant, size, fullWidth, noPaddingX }), className)

  // asChild: consumer fully controls the rendered element; we just stamp our classes.
  if (asChild) {
    return (
      <Slot ref={ref} className={classes} {...props}>
        {children}
      </Slot>
    )
  }

  // Real content stays in layout (preserving width) but goes invisible while loading.
  // The spinner is absolutely positioned so it never shifts the button's size.
  const content = (
    <>
      <span className={cn("contents", loading && "invisible")}>
        {leftIcon && <span className="inline-flex items-center">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="inline-flex items-center">{rightIcon}</span>}
      </span>
      {loading && (
        <span className="absolute inset-0 inline-flex items-center justify-center text-ods-text-primary">
          <Spinner />
        </span>
      )}
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        prefetch={prefetch}
        target={openInNewTab ? "_blank" : undefined}
        rel={openInNewTab ? "noopener noreferrer" : undefined}
        aria-disabled={isDisabled || undefined}
        tabIndex={isDisabled ? -1 : undefined}
        className={cn(classes, isDisabled && "pointer-events-none opacity-50")}
        onClick={onClick as unknown as React.MouseEventHandler<HTMLAnchorElement> | undefined}
      >
        {content}
      </Link>
    )
  }

  return (
    <button
      ref={ref}
      className={classes}
      disabled={isDisabled}
      onClick={onClick}
      {...props}
    >
      {content}
    </button>
  )
})

export { Button, buttonVariants, type ButtonProps }

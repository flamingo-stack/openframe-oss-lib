"use client"

import { cva, type VariantProps } from "class-variance-authority"
import Link from "next/link"
import React from "react"

import { cn } from "../../../utils/cn"
import { buttonSurfaceClasses, splitDividerColorClasses } from "./button-styles"

// Two independent interactive halves: each a `<button>` or `<a>`. The seam is
// a 1px border on the left edge of the icon half, colored per variant. For a
// single-target variant (decorative trailing icon), use `<Button splitIcon>`.

const splitHalfBase = [
  "relative inline-flex items-center justify-center gap-[var(--spacing-system-xsf)]",
  "whitespace-nowrap transition-colors duration-200",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus focus-visible:z-10",
  "disabled:pointer-events-none",
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:h-5 [&_svg]:w-5",
]

const splitHalfVariants = cva(splitHalfBase, {
  variants: {
    variant: {
      accent: buttonSurfaceClasses.accent,
      outline: buttonSurfaceClasses.outline, // Outline border lives in compoundVariants so we can omit the seam edge.
      transparent: buttonSurfaceClasses.transparent,
      destructive: buttonSurfaceClasses.destructive,
    },
    size: {
      default: "h-12 px-[var(--spacing-system-m)] py-[var(--spacing-system-sf)] text-h3",
      small: "h-6 md:h-8 px-[var(--spacing-system-xs)] text-h5",
    },
    side: { main: "", icon: "" },
  },
  compoundVariants: [
    // Rounded corners + per-variant seam. The icon-side's left border is the divider.
    { variant: "accent", side: "main", class: "rounded-l-md" },
    { variant: "accent", side: "icon", class: cn(
      "rounded-r-md border-l",
      splitDividerColorClasses.accent,
      "disabled:border-ods-disabled aria-disabled:border-ods-disabled",
    ) },
    { variant: "destructive", side: "main", class: "rounded-l-md" },
    { variant: "destructive", side: "icon", class: cn(
      "rounded-r-md border-l",
      splitDividerColorClasses.destructive,
      "disabled:border-ods-disabled aria-disabled:border-ods-disabled",
    ) },
    { variant: "outline", side: "main", class: "rounded-l-md border-y border-l border-ods-border" },
    { variant: "outline", side: "icon", class: "rounded-r-md border border-ods-border" },
    { variant: "transparent", side: "main", class: "rounded-md" },
    { variant: "transparent", side: "icon", class: cn("rounded-md", splitDividerColorClasses.transparent) },

    // Icon half: per Figma, narrower than main height (default: 40×48; small: 32×32).
    { side: "icon", size: "default", class: "w-10 px-0" },
    { side: "icon", size: "small", class: "w-6 md:w-8 px-0" },

    { size: "small", class: "[&_svg]:h-4 [&_svg]:w-4" },
  ],
  defaultVariants: { variant: "accent", size: "default", side: "main" },
})

type SplitButtonVariant = NonNullable<VariantProps<typeof splitHalfVariants>["variant"]>
type SplitButtonSize = NonNullable<VariantProps<typeof splitHalfVariants>["size"]>

interface SplitButtonIconAction {
  icon: React.ReactNode
  /** The icon half is interactive but has no visible text — needs an accessible name. */
  "aria-label": string
  onClick?: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>
  href?: string
  openInNewTab?: boolean
  prefetch?: boolean
  disabled?: boolean
}

interface SplitButtonProps {
  variant?: SplitButtonVariant
  size?: SplitButtonSize
  fullWidth?: boolean
  className?: string

  children: React.ReactNode
  onClick?: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>
  href?: string
  openInNewTab?: boolean
  prefetch?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  /** Disables both halves. Equivalent to `mainDisabled && iconAction.disabled`. */
  disabled?: boolean
  /** Disables only the main half. Combine with `iconAction.disabled` for finer control. */
  mainDisabled?: boolean
  type?: "button" | "submit" | "reset"
  "aria-label"?: string
  groupAriaLabel?: string

  iconAction: SplitButtonIconAction
}

interface HalfOptions {
  variant: SplitButtonVariant
  size: SplitButtonSize
  side: "main" | "icon"
  href?: string
  openInNewTab?: boolean
  prefetch?: boolean
  onClick?: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>
  disabled?: boolean
  type?: "button" | "submit" | "reset"
  ariaLabel?: string
  children: React.ReactNode
}

function Half({ variant, size, side, href, openInNewTab, prefetch, onClick, disabled, type = "button", ariaLabel, children }: HalfOptions) {
  const classes = splitHalfVariants({ variant, size, side })

  if (href) {
    return (
      <Link
        href={href}
        prefetch={prefetch}
        target={openInNewTab ? "_blank" : undefined}
        rel={openInNewTab ? "noopener noreferrer" : undefined}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        aria-label={ariaLabel}
        className={cn(classes, disabled && "pointer-events-none")}
        onClick={onClick as unknown as React.MouseEventHandler<HTMLAnchorElement> | undefined}
      >
        {children}
      </Link>
    )
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={onClick as React.MouseEventHandler<HTMLButtonElement>}
    >
      {children}
    </button>
  )
}

const SplitButton = React.forwardRef<HTMLDivElement, SplitButtonProps>(function SplitButton(
  {
    variant = "accent",
    size = "default",
    fullWidth = false,
    className,
    children,
    onClick,
    href,
    openInNewTab,
    prefetch,
    leftIcon,
    rightIcon,
    disabled,
    mainDisabled,
    type,
    iconAction,
    "aria-label": ariaLabel,
    groupAriaLabel,
  },
  ref,
) {
  return (
    <div
      ref={ref}
      role="group"
      aria-label={groupAriaLabel}
      className={cn("inline-flex items-stretch", fullWidth && "w-full", className)}
    >
      <Half
        variant={variant}
        size={size}
        side="main"
        href={href}
        openInNewTab={openInNewTab}
        prefetch={prefetch}
        onClick={onClick}
        disabled={disabled || mainDisabled}
        type={type}
        ariaLabel={ariaLabel}
      >
        {leftIcon && <span className="inline-flex items-center">{leftIcon}</span>}
        <span>{children}</span>
        {rightIcon && <span className="inline-flex items-center">{rightIcon}</span>}
      </Half>
      <Half
        variant={variant}
        size={size}
        side="icon"
        href={iconAction.href}
        openInNewTab={iconAction.openInNewTab}
        prefetch={iconAction.prefetch}
        onClick={iconAction.onClick}
        disabled={disabled || iconAction.disabled}
        ariaLabel={iconAction["aria-label"]}
      >
        <span className="inline-flex items-center">{iconAction.icon}</span>
      </Half>
    </div>
  )
})

export { SplitButton, type SplitButtonProps, type SplitButtonIconAction }

"use client"

import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import Link from "next/link"
import React from "react"

import { cn } from "../../../utils/cn"
import { buttonSurfaceClasses, outlineBorderClasses, splitDividerColorClasses } from "./button-styles"

// Default layout: centered single content area, padding/gap on the button itself.
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
        accent: buttonSurfaceClasses.accent,
        outline: cn(buttonSurfaceClasses.outline, outlineBorderClasses),
        transparent: buttonSurfaceClasses.transparent,
        destructive: buttonSurfaceClasses.destructive,
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

// Split layout (used when `splitIcon` is provided): outer button has no padding;
// inner slots own padding/gap so the divider can span full button height.
const splitShellVariants = cva(
  [
    "group relative inline-flex items-stretch overflow-hidden rounded-md whitespace-nowrap",
    "transition-colors duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus",
    "disabled:pointer-events-none",
  ],
  {
    variants: {
      variant: {
        accent: buttonSurfaceClasses.accent,
        outline: cn(buttonSurfaceClasses.outline, outlineBorderClasses),
        transparent: buttonSurfaceClasses.transparent,
        destructive: buttonSurfaceClasses.destructive,
      },
      size: {
        default: "h-12 text-h3",
        small: "h-6 md:h-8 text-h5",
      },
      fullWidth: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "accent", size: "default", fullWidth: false },
  }
)

const splitSlotVariants = cva(
  ["inline-flex items-center justify-center", "[&_svg]:shrink-0 [&_svg]:h-5 [&_svg]:w-5"],
  {
    variants: {
      slot: {
        main: "gap-[var(--spacing-system-xsf)]",
        icon: "border-l",
      },
      size: { default: "", small: "[&_svg]:h-4 [&_svg]:w-4" },
      variant: { accent: "", outline: "", transparent: "", destructive: "" },
    },
    compoundVariants: [
      { slot: "main", size: "default", class: "px-[var(--spacing-system-m)] py-[var(--spacing-system-sf)]" },
      { slot: "main", size: "small", class: "px-[var(--spacing-system-xs)]" },
      { slot: "icon", size: "default", class: "w-10" },
      { slot: "icon", size: "small", class: "w-6 md:w-8" },
      { slot: "icon", variant: "accent", class: cn(
        splitDividerColorClasses.accent,
        "group-disabled:border-ods-disabled group-aria-disabled:border-ods-disabled",
      ) },
      { slot: "icon", variant: "outline", class: splitDividerColorClasses.outline },
      { slot: "icon", variant: "transparent", class: splitDividerColorClasses.transparent },
      { slot: "icon", variant: "destructive", class: cn(
        splitDividerColorClasses.destructive,
        "group-disabled:border-ods-disabled group-aria-disabled:border-ods-disabled",
      ) },
    ],
    defaultVariants: { slot: "main", size: "default", variant: "accent" },
  }
)

/** @deprecated Use `size="small"` instead. Temporary alias kept for backward compatibility; will be removed in the future. */
type DeprecatedButtonSize = "small-legacy"

type ButtonSize = Exclude<VariantProps<typeof buttonVariants>["size"], "small-legacy" | null | undefined> | DeprecatedButtonSize

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    Omit<VariantProps<typeof buttonVariants>, "size"> {
  asChild?: boolean
  href?: string
  openInNewTab?: boolean
  prefetch?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  /**
   * Renders a vertical divider and trailing icon area inside the button.
   * The whole button stays a single click target — the icon is decorative
   * (`aria-hidden`). For two independent click targets, use `<SplitButton>`.
   * Only honored when `size` is `"default"` or `"small"`.
   */
  splitIcon?: React.ReactNode
  loading?: boolean
  size?: ButtonSize
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
    splitIcon,
    loading,
    children,
    disabled,
    onClick,
    ...props
  },
  ref,
) {
  const isDisabled = disabled || loading

  // splitIcon is only supported for default/small sizes. With other sizes
  // (icon, small-legacy) we silently fall back to the normal layout.
  const useSplitLayout = !!splitIcon && (size === "default" || size === "small" || size === undefined)

  if (useSplitLayout) {
    const safeSize = (size ?? "default") as "default" | "small"
    const safeVariant = (variant ?? "accent") as "accent" | "outline" | "transparent" | "destructive"
    const shellClasses = cn(
      splitShellVariants({ variant: safeVariant, size: safeSize, fullWidth }),
      className,
    )
    const mainSlotClass = splitSlotVariants({ slot: "main", size: safeSize, variant: safeVariant })
    const iconSlotClass = splitSlotVariants({ slot: "icon", size: safeSize, variant: safeVariant })

    const splitContent = (
      <>
        <span className={cn("contents", loading && "invisible")}>
          <span className={mainSlotClass}>
            {leftIcon && <span className="inline-flex items-center">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="inline-flex items-center">{rightIcon}</span>}
          </span>
          <span aria-hidden="true" className={iconSlotClass}>
            {splitIcon}
          </span>
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
          className={cn(shellClasses, isDisabled && "pointer-events-none")}
          onClick={onClick as unknown as React.MouseEventHandler<HTMLAnchorElement> | undefined}
        >
          {splitContent}
        </Link>
      )
    }

    return (
      <button
        ref={ref}
        className={shellClasses}
        disabled={isDisabled}
        onClick={onClick}
        {...props}
      >
        {splitContent}
      </button>
    )
  }

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
        className={cn(classes, isDisabled && "pointer-events-none")}
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

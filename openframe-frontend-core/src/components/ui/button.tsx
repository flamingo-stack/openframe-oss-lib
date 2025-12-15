import React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import Link from "next/link"
import { ExternalLink } from "lucide-react"

import { cn } from "../../utils/cn"

const buttonVariants = cva(
  // Base styles following ButtonFull specifications with Figma-accurate typography
  // Text wrapping enabled - full width on mobile, extra small text and minimal gap for better wrapping
  "whitespace-nowrap inline-flex items-center justify-center gap-1 sm:gap-2 rounded-[6px] font-['DM_Sans'] font-bold text-xs sm:text-lg leading-tight transition-colors duration-200 focus-visible:outline-none disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 !w-full sm:!w-auto text-center",
  {
    variants: {
      variant: { 
        // Primary variant for main CTAs (ButtonFull primary)
        primary: "bg-ods-accent text-ods-text-on-accent hover:bg-ods-accent-hover active:bg-ods-accent-active focus-visible:ring-2 focus-visible:ring-ods-focus disabled:bg-ods-disabled disabled:text-ods-text-secondary disabled:cursor-not-allowed disabled:shadow-none",
        // White background variant for secondary actions (ButtonFull secondary)
        white: "bg-white text-black hover:bg-ods-text-secondary hover:text-black active:bg-ods-text-muted active:text-black focus-visible:ring-2 focus-visible:ring-ods-focus disabled:bg-ods-disabled disabled:text-ods-text-secondary disabled:cursor-not-allowed disabled:shadow-none",
        // Secondary variant for alternative actions (ButtonFull secondary)
        secondary: "bg-ods-text-primary text-black hover:bg-ods-text-secondary hover:text-black active:bg-ods-text-muted active:text-black focus-visible:ring-2 focus-visible:ring-ods-focus disabled:bg-ods-disabled disabled:text-ods-text-secondary disabled:cursor-not-allowed disabled:shadow-none",
        // Outline variant for Submit Product buttons and secondary actions
        outline: "border border-ods-border bg-transparent text-ods-text-primary hover:bg-ods-bg-hover active:bg-ods-bg-active focus-visible:ring-2 focus-visible:ring-ods-focus disabled:border-ods-disabled disabled:text-ods-text-secondary disabled:bg-ods-disabled disabled:cursor-not-allowed disabled:shadow-none",
        // Transparent variant for ghost-like actions (ButtonFull transparent)
        transparent: "bg-transparent text-ods-text-primary hover:bg-ods-bg-hover active:bg-ods-bg-active focus-visible:ring-2 focus-visible:ring-ods-focus disabled:text-ods-text-disabled !w-auto whitespace-nowrap !text-base",
        // Ghost variant for subtle interactions
        ghost: "bg-transparent text-ods-text-primary hover:bg-ods-bg-hover active:bg-ods-bg-active focus-visible:ring-2 focus-visible:ring-ods-focus disabled:text-ods-text-disabled !w-auto whitespace-nowrap !text-base",
        // Ghost navigation variant - left-aligned for navigation menus
        "ghost-nav": "bg-transparent text-ods-text-primary hover:bg-ods-bg-hover active:bg-ods-bg-active focus-visible:ring-2 focus-visible:ring-ods-focus disabled:text-ods-text-disabled justify-start !w-auto whitespace-nowrap !text-base",
        // Link variant for text-like buttons
        link: "bg-transparent text-ods-link underline-offset-4 hover:underline hover:text-ods-link-hover focus-visible:ring-2 focus-visible:ring-ods-focus disabled:text-ods-text-disabled",
        // Search variant for search containers
        search: "bg-ods-card border border-ods-border text-ods-text-primary hover:bg-ods-bg-hover hover:border-ods-border focus-visible:ring-2 focus-visible:ring-ods-focus disabled:bg-ods-disabled disabled:text-ods-text-disabled",
        // Special variant for submit product buttons (header usage)
        submit: "border border-ods-border bg-transparent text-ods-text-primary hover:bg-ods-bg-hover focus:bg-ods-bg-hover focus-visible:ring-2 focus-visible:ring-ods-focus disabled:border-ods-disabled disabled:text-ods-text-disabled",
        // Destructive variant for dangerous actions
        destructive: "bg-ods-error text-ods-text-on-dark hover:bg-ods-error-hover active:bg-ods-error-active focus-visible:ring-2 focus-visible:ring-ods-focus disabled:bg-ods-disabled disabled:text-ods-text-disabled",
        // Success variant for positive actions
        success: "bg-ods-success text-ods-text-on-dark hover:bg-ods-success-hover active:bg-ods-success-active focus-visible:ring-2 focus-visible:ring-ods-focus disabled:bg-ods-disabled disabled:text-ods-text-disabled",
        // Warning variant for cautionary actions
        warning: "bg-ods-warning text-ods-text-on-accent hover:bg-ods-warning-hover active:bg-ods-warning-active focus-visible:ring-2 focus-visible:ring-ods-focus disabled:bg-ods-disabled disabled:text-ods-text-disabled",
        // Info variant for informational actions
        info: "bg-ods-info text-ods-text-on-dark hover:bg-ods-info-hover active:bg-ods-info-active focus-visible:ring-2 focus-visible:ring-ods-focus disabled:bg-ods-disabled disabled:text-ods-text-disabled",
        // Flamingo primary variant - pink background with black text
        "flamingo-primary": "bg-[var(--ods-flamingo-pink-base)] text-[var(--ods-system-greys-black)] hover:bg-[var(--ods-flamingo-pink-hover)] active:bg-[var(--ods-flamingo-pink-active)] focus-visible:ring-2 focus-visible:ring-ods-focus disabled:bg-ods-disabled disabled:text-ods-text-disabled",
        // Flamingo secondary variant - dark background with border
        "flamingo-secondary": "bg-[var(--ods-system-greys-black)] border border-[var(--ods-system-greys-soft-grey)] text-[var(--ods-system-greys-white)] hover:border-[var(--ods-system-greys-grey)] hover:bg-[var(--ods-system-greys-dark-grey)] active:bg-[var(--ods-system-greys-grey)] focus-visible:ring-2 focus-visible:ring-ods-focus disabled:bg-ods-disabled disabled:text-ods-text-disabled",
        // Footer link variant - minimal spacing, left-aligned, no gap
        "footer-link": "!gap-0 !p-0 !h-auto bg-transparent text-ods-text-primary hover:text-ods-accent-primary transition-colors justify-start font-body font-medium !text-md md:!text-md leading-[1.33] mb-1",
        // Filter variant - for category/filter buttons in sidebars
        "filter": "w-full justify-start text-[16px] py-3 px-2 font-medium font-['DM_Sans'] rounded-lg h-12 transition-all duration-150 leading-[1.33em] bg-ods-card border border-ods-border hover:bg-[#2A2A2A] text-ods-text-primary text-left",
        "filter-active": "w-full justify-start text-[16px] py-3 px-2 font-medium font-['DM_Sans'] rounded-lg h-12 transition-all duration-150 leading-[1.33em] bg-ods-border border border-ods-border text-ods-text-primary text-left relative",
        // Section selector variant - for feature/section selection buttons
        "section": "bg-ods-card border border-ods-border shadow-ods-card !text-left !justify-start !items-start transition-all duration-200 hover:bg-ods-card-hover disabled:opacity-50 disabled:cursor-not-allowed",
        "section-active": "bg-ods-card border border-[var(--ods-open-yellow-base)] shadow-ods-card !text-left !justify-start !items-start transition-all duration-200 hover:bg-ods-card-hover disabled:opacity-50 disabled:cursor-not-allowed",
        // Table display variant - for non-interactive display in tables (no hover, no padding)
        "table-display": "bg-transparent text-ods-text-primary cursor-default pointer-events-none font-normal",
        // Device action variant - for device detail page action buttons
        "device-action": "bg-ods-card border border-ods-border hover:bg-ods-bg-hover text-ods-text-primary px-4 py-3 rounded-[6px] font-['DM_Sans'] font-bold text-[18px] tracking-[-0.36px] disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-ods-card disabled:text-ods-text-secondary",
      },
      size: {
        // Small size for secondary actions
        sm: "h-10 px-2 sm:px-6 py-2 text-sm",
        // Default size for most buttons (ButtonFull default)
        default: "h-12 px-2 sm:px-8 py-3 text-base",
        // Large size for prominent CTAs (ButtonFull lg) - adjusted for better text/icon fit
        lg: "min-h-[48px] px-2 sm:px-8 py-3 text-base",
        // Icon-only buttons - fixed square size on all breakpoints
        icon: "!w-10 sm:!w-10 h-10 p-0",
        // Icon-only large buttons (like hamburger menu) - fixed square size on all breakpoints
        iconLg: "!w-12 sm:!w-12 h-12 p-0",
        // Touch-friendly mobile sizing
        touch: "min-h-[44px] px-6 py-3 text-base",
        // Search button specific sizing
        searchMobile: "min-h-[56px] px-4 py-3 text-lg",
        searchDesktop: "min-h-[52px] px-4 py-3 text-lg",
        // No size - used for footer links
        none: "",
        // Section size - custom padding for section selector buttons
        section: "p-6 min-h-[96px]",
        // Section wrap size - for wrapped layout
        sectionWrap: "pl-4 pr-4 lg:pr-10 py-4 h-[76px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  href?: string
  /**
   * Open the link in a new tab when href is provided
   */
  openInNewTab?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  /**
   * Render an icon perfectly centered inside the button. Useful for icon-only
   * actions (e.g. close, hamburger) where the default `gap-2` from the base
   * styles would otherwise shift the icon slightly to the left.
   */
  centerIcon?: React.ReactNode
  loading?: boolean
  /**
   * Control whether the button should be full width on mobile
   * Default is true for most buttons, but icon-only and footer-link variants override this
   */
  fullWidthOnMobile?: boolean
  /**
   * Alignment of button content
   * Default is 'center', can be 'left', 'right', or 'center'
   */
  alignment?: 'left' | 'center' | 'right'
  /**
   * Show an external link icon on hover that opens href in a new tab.
   * Only works when href is provided. Clicking the icon opens in new tab,
   * clicking elsewhere on the button navigates normally.
   */
  showExternalLinkOnHover?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, href, openInNewTab = false, leftIcon, rightIcon, centerIcon, loading, children, disabled, onClick, fullWidthOnMobile, alignment = 'center', showExternalLinkOnHover, ...props }, ref) => {
    const isDisabled = disabled || loading

    const isCenterIconOnly = !!centerIcon && !children && !leftIcon && !rightIcon
    const isFooterLink = variant === "footer-link"

    // Map alignment to justify classes
    const alignmentClasses = {
      left: 'justify-start',
      center: 'justify-center',
      right: 'justify-end'
    }

    const composedClassName = cn(
      buttonVariants({ variant, size, className }),
      // Remove the default gap when we have a single centered icon so the icon
      // sits exactly in the middle.
      isCenterIconOnly && "gap-0",
      // Also remove gap for footer links
      isFooterLink && "gap-0",
      // Handle explicit fullWidthOnMobile prop override
      fullWidthOnMobile === false && "!w-auto",
      // Apply alignment
      alignment && `!${alignmentClasses[alignment]}`
    )
    
    // Content to render inside the button/link
    const renderContent = () => {
      // Center icon takes priority and renders by itself
      if (isCenterIconOnly && !loading) {
        return (
          <span className="flex items-center justify-center">{centerIcon}</span>
        )
      }

      // Standard left icon / children / right icon flow
      if (!isCenterIconOnly) {
        return (
          <>
            {leftIcon && !loading && <span className="flex items-center justify-center">{leftIcon}</span>}
            {loading && (
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {children && (
              <span className={cn(loading && "opacity-70")}>{children}</span>
            )}
            {rightIcon && !loading && <span className="flex items-center justify-center">{rightIcon}</span>}
          </>
        )
      }
    }
    
    // When asChild is true, let the child element handle its own content structure
    if (asChild) {
      return (
        <Slot
          className={composedClassName}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      )
    }
    
    // When href is provided, render as Next.js Link for client-side navigation
    if (href) {
      // Handle onClick type conversion for Link component
      const handleLinkClick = onClick
        ? (e: React.MouseEvent<HTMLAnchorElement>) => {
            onClick(e as unknown as React.MouseEvent<HTMLButtonElement>)
          }
        : undefined

      // Handle external link icon click
      const handleExternalClick = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        window.open(href, '_blank', 'noopener,noreferrer')
      }

      return (
        <Link
          href={href}
          className={cn(composedClassName, showExternalLinkOnHover && 'group', isDisabled ? "pointer-events-none cursor-not-allowed opacity-50 text-ods-text-secondary" : '')}
          aria-disabled={isDisabled}
          tabIndex={isDisabled ? -1 : undefined}
          target={openInNewTab ? '_blank' : undefined}
          rel={openInNewTab ? 'noopener noreferrer' : undefined}
          onClick={handleLinkClick}
        >
          {renderContent()}
          {showExternalLinkOnHover && !isDisabled && (
            <span
              className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto hover:text-ods-text-primary"
              onClick={handleExternalClick}
            >
              <ExternalLink
                className="w-4 h-4 text-ods-text-secondary transition-colors cursor-pointer pointer-events-auto"
              />
            </span>
          )}
        </Link>
      )
    }
    
    // Default button rendering
    return (
      <button
        className={composedClassName}
        ref={ref}
        disabled={isDisabled}
        onClick={onClick}
        {...props}
      >
        {renderContent()}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants, type ButtonProps }

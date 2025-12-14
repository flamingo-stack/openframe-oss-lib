"use client"

import React from "react"
import { cn } from "../../utils/cn"

export interface InteractiveCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Children elements to render inside the card
   */
  children: React.ReactNode

  /**
   * Click handler for the card
   */
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void

  /**
   * Enable clickable/hover behavior
   * Default: true if onClick is provided, false otherwise
   */
  clickable?: boolean

  /**
   * Custom hover accent color (default: ods-accent)
   * When provided, border and h3 titles will use this color on hover
   */
  hoverAccentColor?: string

  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * InteractiveCard - Base component for clickable cards with hover effects
 *
 * Provides the same hover pattern as VendorCard and OrganizationCard:
 * - Border changes to accent color on hover
 * - H3 titles change to accent color on hover
 * - Smooth transitions
 * - Cursor pointer
 * - Group class for child hover states
 *
 * Usage Examples:
 *
 * ```typescript
 * // Basic clickable card
 * <InteractiveCard onClick={() => navigate('/details')}>
 *   <h3>Title</h3>
 *   <p>Content...</p>
 * </InteractiveCard>
 *
 * // With custom accent color
 * <InteractiveCard
 *   onClick={handleClick}
 *   hoverAccentColor="#00D4AA"
 * >
 *   <h3>Title changes to cyan on hover</h3>
 * </InteractiveCard>
 *
 * // Non-clickable card (no hover)
 * <InteractiveCard clickable={false}>
 *   <h3>Static content</h3>
 * </InteractiveCard>
 * ```
 */
export const InteractiveCard = React.forwardRef<HTMLDivElement, InteractiveCardProps>(
  (
    {
      children,
      onClick,
      clickable,
      hoverAccentColor,
      className,
      ...props
    },
    ref
  ) => {
    // Auto-enable clickable if onClick is provided
    const isClickable = clickable !== undefined ? clickable : !!onClick

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (isClickable && onClick) {
        onClick(e)
      }
    }

    const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
      if (hoverAccentColor && isClickable) {
        e.currentTarget.style.borderColor = hoverAccentColor
        // Change h3 titles
        const title = e.currentTarget.querySelector('h3')
        if (title) {
          (title as HTMLElement).style.color = hoverAccentColor
        }
        // Change primary text elements (large values, main content)
        // Exclude button text from color change
        const primaryTexts = e.currentTarget.querySelectorAll('.text-ods-text-primary:not(button):not(button *)')
        primaryTexts.forEach((el) => {
          (el as HTMLElement).style.color = hoverAccentColor
        })
      }
    }

    const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
      if (hoverAccentColor && isClickable) {
        e.currentTarget.style.borderColor = ''
        // Reset h3 titles
        const title = e.currentTarget.querySelector('h3')
        if (title) {
          (title as HTMLElement).style.color = ''
        }
        // Reset primary text elements
        const primaryTexts = e.currentTarget.querySelectorAll('.text-ods-text-primary:not(button):not(button *)')
        primaryTexts.forEach((el) => {
          (el as HTMLElement).style.color = ''
        })
      }
    }

    return (
      <div
        ref={ref}
        className={cn(
          "transition-all",
          isClickable && [
            "cursor-pointer",
            "group",
            !hoverAccentColor && [
              "hover:border-ods-accent",
              // H3 titles turn accent on hover
              "[&:hover_h3]:text-ods-accent",
              // Primary text turns accent on hover (but not inside buttons)
              "[&:hover_.text-ods-text-primary:not(button):not(button_*)]:text-ods-accent"
            ]
          ],
          className
        )}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={hoverAccentColor ? {
          ['--hover-accent' as any]: hoverAccentColor
        } : undefined}
        {...props}
      >
        {children}
      </div>
    )
  }
)

InteractiveCard.displayName = "InteractiveCard"

import React from "react"

import { cn } from "../../../utils/cn"
import {
  noDataActionInteractiveClasses,
  noDataActionsVariants,
  noDataIconClasses,
  type NoDataActionsVariant,
} from "./no-data-styles"

interface NoDataActionProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  /** Leading glyph, sized to 16px (mobile) / 24px (md+). Optional. */
  icon?: React.ReactNode
  /** Short label describing the block. */
  label?: React.ReactNode
}

/**
 * A single clickable block: a leading icon with a short label, laid out
 * icon-beside-label on mobile and icon-above-label on larger screens. Tints on
 * hover, shows a focus ring for keyboard users, and grays out when disabled.
 * The outer border, rounded corners and dividers come from the surrounding
 * group, so on its own it has no frame.
 */
const NoDataAction = React.forwardRef<HTMLButtonElement, NoDataActionProps>(
  function NoDataAction({ icon, label, children, className, disabled, type, ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        disabled={disabled}
        className={cn(
          "flex flex-1 items-center gap-[var(--spacing-system-s)] p-[var(--spacing-system-m)] text-left text-ods-text-secondary",
          "md:flex-col md:items-start md:gap-[var(--spacing-system-xs)]",
          noDataActionInteractiveClasses,
          className,
        )}
        {...props}
      >
        {icon && <span className={noDataIconClasses}>{icon}</span>}
        <span className="min-w-0 flex-1 break-words text-h6 md:w-full md:flex-none">
          {label ?? children}
        </span>
      </button>
    )
  },
)

interface NoDataActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The blocks to render. Count is dynamic — any number works. When omitted,
   * `children` are rendered instead.
   */
  actions?: NoDataActionProps[]
  /** Surface treatment of the group panel. */
  variant?: NoDataActionsVariant
}

/**
 * A group of clickable blocks sharing one bordered, card-colored panel. Renders
 * as a horizontal row with vertical dividers on larger screens and a vertical
 * stack with horizontal dividers on mobile, switching automatically. Only the
 * outermost blocks have rounded corners.
 */
const NoDataActions = React.forwardRef<HTMLDivElement, NoDataActionsProps>(
  function NoDataActions({ actions, variant = "outline", className, children, ...props }, ref) {
    const blocks = actions
      ? actions.map((action, index) => <NoDataAction key={index} {...action} />)
      : React.Children.toArray(children)

    return (
      <div
        ref={ref}
        className={cn(
          noDataActionsVariants({ variant }),
          "flex w-full flex-col md:w-auto md:flex-row",
          className,
        )}
        {...props}
      >
        {blocks.map((block, index) => (
          <React.Fragment key={index}>
            {index > 0 && (
              <div
                aria-hidden="true"
                className="shrink-0 self-stretch border-t border-ods-border md:border-l md:border-t-0"
              />
            )}
            {block}
          </React.Fragment>
        ))}
      </div>
    )
  },
)

export {
  NoDataAction,
  NoDataActions,
  type NoDataActionProps,
  type NoDataActionsProps,
}

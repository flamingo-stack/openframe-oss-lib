import React from "react"

import { cn } from "../../../utils/cn"
import { noDataActionsVariants, noDataIconClasses, type NoDataActionsVariant } from "./no-data-styles"

interface NoDataActionProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Leading glyph, sized to 16px (mobile) / 24px (md+). Optional. */
  icon?: React.ReactNode
  /** Short label describing the block. */
  label?: React.ReactNode
}

/**
 * A single static info block: a leading icon with a short label, laid out
 * icon-beside-label on mobile and icon-above-label on larger screens. Purely
 * presentational — no hover or click. The outer border, rounded corners and
 * dividers come from the surrounding group. Capped at 244px wide on md+.
 */
const NoDataAction = React.forwardRef<HTMLDivElement, NoDataActionProps>(
  function NoDataAction({ icon, label, children, className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-1 items-center gap-[var(--spacing-system-s)] p-[var(--spacing-system-m)] text-ods-text-secondary",
          "md:w-[224px] md:flex-none md:flex-col md:items-start md:gap-[var(--spacing-system-xs)]",
          className,
        )}
        {...props}
      >
        {icon && <span className={noDataIconClasses}>{icon}</span>}
        <span className="min-w-0 flex-1 break-words text-h6 md:w-full md:flex-none">{label ?? children}</span>
      </div>
    )
  },
)

interface NoDataActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The blocks to render. When omitted, `children` are rendered instead. */
  actions?: NoDataActionProps[]
  /** Surface treatment of the group panel. */
  variant?: NoDataActionsVariant
}

/**
 * A group of static info blocks sharing one transparent, bordered panel. Renders
 * as a horizontal row with vertical dividers on larger screens and a vertical
 * stack with horizontal dividers on mobile. Only the outermost blocks have
 * rounded corners.
 */
const NoDataActions = React.forwardRef<HTMLDivElement, NoDataActionsProps>(
  function NoDataActions({ actions, variant = "outline", className, children, ...props }, ref) {
    const blocks = actions
      ? actions.map((action, index) => <NoDataAction key={index} {...action} />)
      : React.Children.toArray(children)

    return (
      <div
        ref={ref}
        className={cn(noDataActionsVariants({ variant }), "flex w-full flex-col md:w-auto md:flex-row", className)}
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

export { NoDataAction, NoDataActions, type NoDataActionProps, type NoDataActionsProps }

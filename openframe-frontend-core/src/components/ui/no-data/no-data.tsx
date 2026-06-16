import React from "react"

import { cn } from "../../../utils/cn"
import { Button, type ButtonProps } from "../button"
import { NoDataMessage } from "./no-data-message"
import { NoDataActions, type NoDataActionProps } from "./no-data-actions"

interface NoDataProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  // --- Message ---
  /** Leading glyph, sized to 16px (mobile) / 24px (md+). */
  icon?: React.ReactNode
  /** Primary line. */
  title?: React.ReactNode
  /** Secondary line. */
  description?: React.ReactNode

  // --- Clickable blocks ---
  /** Clickable blocks. Dynamic count. Hidden when empty/omitted. */
  actions?: NoDataActionProps[]

  // --- Footer button ---
  /** Footer button label. When set (and `button` is not), renders the button. */
  buttonLabel?: React.ReactNode
  /** Leading icon for the footer button. */
  buttonIcon?: React.ReactNode
  /** Click handler for the footer button. */
  onButtonClick?: ButtonProps["onClick"]
  /** Extra props forwarded to the footer button (variant, href, loading, …). */
  buttonProps?: Partial<ButtonProps>
  /** Fully custom footer node; overrides the `buttonLabel`/`buttonIcon` path. */
  button?: React.ReactNode
}

/**
 * A centered empty-state panel: a muted icon/title/description message, an
 * optional group of clickable blocks, and an optional footer button, stacked
 * vertically with breakpoint-aware spacing. Each region renders only when its
 * inputs are present, so the same component covers a bare message, a message
 * with a button, the full layout, and everything in between.
 */
const NoData = React.forwardRef<HTMLDivElement, NoDataProps>(function NoData(
  {
    icon,
    title,
    description,
    actions,
    buttonLabel,
    buttonIcon,
    onButtonClick,
    buttonProps,
    button,
    className,
    ...props
  },
  ref,
) {
  const hasMessage = !!(icon || title || description)
  const hasActions = !!actions?.length

  const footerButton =
    button ??
    (buttonLabel != null ? (
      <Button
        variant="outline"
        leftIcon={buttonIcon}
        onClick={onButtonClick}
        {...buttonProps}
        className={cn("w-full md:w-auto", buttonProps?.className)}
      >
        {buttonLabel}
      </Button>
    ) : null)

  return (
    <div
      ref={ref}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-[var(--spacing-system-l)] p-[var(--spacing-system-l)]",
        className,
      )}
      {...props}
    >
      {hasMessage && <NoDataMessage icon={icon} title={title} description={description} />}
      {hasActions && <NoDataActions actions={actions} />}
      {footerButton}
    </div>
  )
})

export { NoData, type NoDataProps }

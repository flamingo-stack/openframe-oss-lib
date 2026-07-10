"use client"

import * as PopoverPrimitive from "@radix-ui/react-popover"
import * as React from "react"
import { cn } from "../../utils/cn"
import { usePortalContainer } from "./portal-container"

export interface FieldWrapperProps {
  /** Label text displayed above the field */
  label?: string
  /** Status message displayed below the field. Space is always reserved to prevent layout shifts. */
  error?: string
  /** Color variant for the message: "error" (red), "warning" (yellow), "success" (green) or "muted" (grey) */
  errorVariant?: "error" | "warning" | "success" | "muted"
  /** Additional className for the outer wrapper */
  className?: string
  children: React.ReactNode
}

const errorVariantClasses = {
  error: "text-ods-error",
  warning: "text-[var(--ods-attention-yellow-warning)]",
  success: "text-ods-success",
  muted: "text-ods-text-secondary",
} as const

/**
 * Status line under a field: one truncated line so the layout never jumps.
 * When the text actually overflows, it becomes a click/tap trigger that opens
 * a popover with the full message — works on touch, unlike a hover tooltip.
 */
function FieldMessage({ text, variant }: { text: string; variant: keyof typeof errorVariantClasses }) {
  const textRef = React.useRef<HTMLButtonElement>(null)
  const [isTruncated, setIsTruncated] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const container = usePortalContainer()

  // Re-measure when the message changes or the field resizes.
  React.useLayoutEffect(() => {
    const el = textRef.current
    if (!el) return
    const measure = () => setIsTruncated(el.scrollWidth > el.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <PopoverPrimitive.Root open={open && isTruncated} onOpenChange={(next) => setOpen(next && isTruncated)}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          ref={textRef}
          tabIndex={isTruncated ? 0 : -1}
          className={cn(
            "block w-full truncate text-left text-h6",
            errorVariantClasses[variant],
            isTruncated ? "cursor-pointer underline decoration-dotted underline-offset-2" : "cursor-default",
          )}
        >
          {text}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal container={container ?? undefined}>
        <PopoverPrimitive.Content
          side="bottom"
          align="start"
          sideOffset={4}
          className={cn(
            "z-[1400] max-w-[calc(100vw-2*var(--spacing-system-l))] rounded-md border border-ods-border bg-ods-card px-3 py-2 text-h6 shadow-lg",
            "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            errorVariantClasses[variant],
          )}
        >
          {text}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

const FieldWrapper = React.forwardRef<HTMLDivElement, FieldWrapperProps>(
  ({ label, error, errorVariant = "error", className, children }, ref) => {
    const hasChrome = label != null || error != null

    return (
      <div ref={ref} className={cn(hasChrome ? "relative flex w-full flex-col" : "contents", className)}>
        {label && (
          <label className="text-h4 text-ods-text-primary mb-1">
            {label}
          </label>
        )}
        {children}
        {error && (
          <div className="absolute bottom-0 left-0 right-0 translate-y-full">
            <FieldMessage text={error} variant={errorVariant} />
          </div>
        )}
      </div>
    )
  }
)
FieldWrapper.displayName = "FieldWrapper"

export { FieldWrapper }

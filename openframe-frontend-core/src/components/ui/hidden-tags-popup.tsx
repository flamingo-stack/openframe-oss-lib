"use client"

import { type CSSProperties, type ForwardedRef, type ReactNode, forwardRef } from "react"
import { XmarkCircleIcon } from "../icons-v2-generated/signs-and-symbols/xmark-circle-icon"
import { cn } from "../../utils/cn"

export interface HiddenTagItem {
  label: ReactNode
  value: unknown
}

export interface HiddenTagsPopupProps {
  items: HiddenTagItem[]
  onRemove?: (value: unknown) => void
  disabled?: boolean
  className?: string
  style?: CSSProperties
}

export const HiddenTagsPopup = forwardRef(function HiddenTagsPopup(
  { items, onRemove, disabled, className, style }: HiddenTagsPopupProps,
  ref: ForwardedRef<HTMLDivElement>,
) {
  return (
    <div
      ref={ref}
      style={style}
      className={cn(
        "absolute top-full left-0 mt-1 z-50 min-w-[200px]",
        "bg-ods-card border border-ods-border rounded-[6px] shadow-lg",
        "animate-in fade-in-0 zoom-in-95 duration-150",
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={String(item.value)}
          className={cn(
            "flex items-center justify-between gap-3 px-3 h-11 md:h-12",
            "border-b border-ods-border last:border-b-0",
          )}
        >
          <span className="text-h5 truncate uppercase text-ods-text-primary">
            {item.label}
          </span>
          {!disabled && onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRemove(item.value)
              }}
              className="shrink-0 text-ods-text-secondary hover:text-ods-text-primary transition-colors"
              aria-label={`Remove ${String(item.label)}`}
            >
              <XmarkCircleIcon size={20} />
            </button>
          )}
        </div>
      ))}
    </div>
  )
})

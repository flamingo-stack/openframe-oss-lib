"use client"

import * as React from "react"

import { cn } from "../../utils/cn"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** When true, renders red error border & ring */
  invalid?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid = false, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          // Layout & spacing - match Input
          "flex min-h-[96px] w-full rounded-[6px] border p-3",
          // Typography - match Input exactly
          "text-[18px] font-medium leading-6",
          // Focus & disabled states - match Input
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ods-accent/20 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
          // Animations & touch UX
          "transition-colors duration-200 touch-manipulation",
          // Theme palette - match Input exactly
          "bg-[#212121] border-[#3a3a3a] text-ods-text-primary placeholder:text-[#888] hover:border-ods-accent/30 focus:border-ods-accent",
          // Ensure proper cursor/stacking
          "cursor-text relative z-10",
          // Textarea-specific
          "resize-y",
          // Invalid state
          invalid && "border-red-500 focus-visible:ring-red-500",
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
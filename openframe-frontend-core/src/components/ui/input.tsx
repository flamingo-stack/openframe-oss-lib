"use client"

import * as React from "react";

import { cn } from "../../utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** When true, renders red error border & ring */
  invalid?: boolean;
  /** Element displayed at the start (left) of the input */
  startAdornment?: React.ReactNode;
  /** Element displayed at the end (right) of the input */
  endAdornment?: React.ReactNode;
  /** When true, renders as a non-interactive div displaying the value */
  preview?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, invalid = false, startAdornment, endAdornment, preview = false, ...props }, ref) => {
    const hasAdornments = startAdornment || endAdornment

    if (preview) {
      return (
        <div
          className={cn(
            // Layout & spacing
            "flex w-full items-center gap-2 rounded-[6px] border px-3 h-11 sm:h-12",
            // Theme palette
            "bg-[#212121] border-[#3a3a3a]",
            // Typography
            "text-[18px] font-medium leading-6 text-ods-text-primary",
            className
          )}
        >
          {startAdornment && (
            <div className="flex-shrink-0 text-[#888] text-[14px] leading-[20px] font-medium">
              {startAdornment}
            </div>
          )}
          <span className="flex-1 min-w-0 truncate">
            {props.value ?? props.defaultValue ?? ""}
          </span>
          {endAdornment && (
            <div className="flex-shrink-0 text-[#888] text-[14px] leading-[20px] font-medium">
              {endAdornment}
            </div>
          )}
        </div>
      )
    }

    if (hasAdornments) {
      return (
        <label
          className={cn(
            // Layout & spacing
            "flex w-full items-center gap-2 rounded-[6px] border px-3 h-11 sm:h-12 cursor-text",
            // Focus-within states
            "has-[:focus-visible]:outline-none has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-ods-accent/20 has-[:focus-visible]:ring-offset-0",
            // Animations & touch UX
            "transition-colors duration-200",
            // Theme palette
            "bg-[#212121] border-[#3a3a3a] hover:border-ods-accent/30 has-[:focus]:border-ods-accent",
            // Disabled
            props.disabled && "cursor-not-allowed opacity-50",
            // Invalid
            invalid && "border-red-500 has-[:focus-visible]:ring-red-500",
            className
          )}
        >
          {startAdornment && (
            <span className="flex-shrink-0 text-[#888] text-[14px] leading-[20px] font-medium">
              {startAdornment}
            </span>
          )}
          <input
            type={type}
            className={cn(
              // Layout
              "flex-1 min-w-0 bg-transparent border-none outline-none",
              // Typography
              "text-[18px] font-medium leading-6",
              // Colors
              "text-ods-text-primary placeholder:text-[#888]",
              // File input adjustments
              "file:border-0 file:bg-transparent file:text-[18px] file:font-medium",
              // Disabled
              "disabled:cursor-not-allowed",
              // Touch
              "touch-manipulation"
            )}
            ref={ref}
            {...props}
          />
          {endAdornment && (
            <span className="flex-shrink-0 text-[#888] text-[14px] leading-[20px] font-medium">
              {endAdornment}
            </span>
          )}
        </label>
      )
    }

    return (
      <input
        type={type}
        className={cn(
          // Layout & spacing
          "flex w-full items-center rounded-[6px] border px-3 h-11 sm:h-12",
          // Typography
          "text-[18px] font-medium leading-6",
          // File input adjustments
          "ring-offset-background file:border-0 file:bg-transparent file:text-[18px] file:font-medium",
          // Focus & disabled states
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ods-accent/20 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
          // Animations & touch UX
          "transition-colors duration-200 touch-manipulation",
          // Theme palette
          "bg-[#212121] border-[#3a3a3a] text-ods-text-primary placeholder:text-[#888] hover:border-ods-accent/30 focus:border-ods-accent",
          // Ensure proper cursor/stacking
          "cursor-text relative z-10",
          invalid && "border-red-500 focus-visible:ring-red-500",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input };


"use client"

import * as React from "react";

import { Loader2 } from "lucide-react";
import { cn } from "../../utils/cn";
import { FieldWrapper } from "./field-wrapper";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** When true, renders red error border & ring */
  invalid?: boolean;
  /** Element displayed at the start (left) of the input */
  startAdornment?: React.ReactNode;
  /** Element displayed at the end (right) of the input */
  endAdornment?: React.ReactNode;
  /** Label text displayed above the input */
  label?: string;
  /** Error message displayed below the input */
  error?: string;
  /** When true, shows a loading spinner as end adornment */
  loading?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, invalid = false, startAdornment, endAdornment, label, error, loading = false, ...props }, ref) => {
    const isInvalid = invalid || !!error

    const content = (
      <label
        data-invalid={isInvalid || undefined}
        className={cn(
          // Layout & spacing
          "flex w-full items-center gap-2 rounded-[6px] border px-3 h-11 sm:h-12 cursor-text",
          // Focus-within states
          "has-[:focus-visible]:outline-none",
          "group",
          // Animations & touch UX
          "transition-colors duration-200",
          // Theme palette
          "bg-ods-card border-ods-border hover:border-ods-accent/30 has-[:focus]:border-ods-accent",
          // Disabled
          props.disabled && "cursor-not-allowed opacity-50",
          // Invalid
          isInvalid && "border-ods-error hover:border-ods-error has-[:focus]:border-ods-error",
          className
        )}
      >
        {startAdornment && (
          <span className="flex-shrink-0 text-ods-text-secondary text-[14px] leading-[20px] font-medium transition-colors duration-200 group-has-[:focus]:text-ods-accent group-data-[invalid]:text-ods-error [&_svg]:size-4 sm:[&_svg]:size-6">
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
            "text-ods-text-primary placeholder:text-ods-text-secondary",
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
        {loading && (
          <Loader2 className="animate-spin flex-shrink-0 text-ods-text-secondary size-4 sm:size-6" />
        )}
        {!loading && endAdornment && (
          <span className="flex-shrink-0 text-ods-text-secondary text-[14px] leading-[20px] font-medium transition-colors duration-200 group-has-[:focus]:text-ods-accent group-data-[invalid]:text-ods-error [&_svg]:size-4 sm:[&_svg]:size-6">
            {endAdornment}
          </span>
        )}
      </label>
    )

    if (label !== undefined || error !== undefined) {
      return (
        <FieldWrapper label={label} error={error}>
          {content}
        </FieldWrapper>
      )
    }

    return <>{content}</>
  }
)
Input.displayName = "Input"

export { Input };

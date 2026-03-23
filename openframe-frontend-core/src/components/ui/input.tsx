"use client"

import * as React from "react";

import { Loader2 } from "lucide-react";
import { cn } from "../../utils/cn";
import { FieldWrapper } from "./field-wrapper";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** When true, renders error border & ring */
  invalid?: boolean;
  /** Element displayed at the start (left) of the input */
  startAdornment?: React.ReactNode;
  /** Element displayed at the end (right) of the input */
  endAdornment?: React.ReactNode;
  /** Label text displayed above the input */
  label?: string;
  /** Error message displayed below the input */
  error?: string;
  /** Color variant for error state: "error" (red) or "warning" (yellow) */
  errorVariant?: "error" | "warning";
  /** When true, shows a loading spinner as end adornment */
  loading?: boolean;
}

const invalidBorderClasses = {
  error: "border-ods-error hover:border-ods-error has-[:focus]:border-ods-error",
  warning: "!border-[var(--ods-attention-yellow-warning)] hover:!border-[var(--ods-attention-yellow-warning)] has-[:focus]:!border-[var(--ods-attention-yellow-warning)]",
} as const;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, invalid = false, startAdornment, endAdornment, label, error, errorVariant = "error", loading = false, ...props }, ref) => {
    const isInvalid = invalid || !!error

    const content = (
      <label
        data-invalid={isInvalid || undefined}
        className={cn(
          // Layout & spacing
          "flex w-full items-center gap-2 rounded-[6px] border px-3 h-11 md:h-12 cursor-text",
          // Focus-within states
          "has-[:focus-visible]:outline-none",
          "group",
          // Animations & touch UX
          "transition-colors duration-200",
          // Theme palette
          "bg-ods-card border-ods-border has-[:focus]:border-ods-accent",
          // Hover & active (not disabled)
          !props.disabled && "hover:bg-ods-bg-hover hover:border-ods-border-hover active:bg-ods-bg-active active:border-ods-border-active",
          // Disabled
          props.disabled && "!cursor-not-allowed bg-ods-bg",
          // Invalid
          isInvalid && invalidBorderClasses[errorVariant],
          className
        )}
      >
        {startAdornment && (
          <span className="text-h6 flex-shrink-0 text-ods-text-secondary transition-colors duration-200 group-has-[:focus]:text-ods-accent group-data-[invalid]:text-ods-error [&_svg]:size-4 md:[&_svg]:size-6">
            {startAdornment}
          </span>
        )}
        <input
          type={type}
          className={cn(
            // Layout
            "flex-1 min-w-0 bg-transparent border-none outline-none",
            // Typography
            // "text-h4",
            // Colors
            "text-ods-text-primary placeholder:text-ods-text-secondary",
            // File input adjustments
            "file:border-0 file:bg-transparent",
            // Disabled
            "disabled:cursor-not-allowed disabled:placeholder:text-ods-border",
            // Touch
            "touch-manipulation"
          )}
          ref={ref}
          {...props}
        />
        {loading && (
          <Loader2 className="animate-spin flex-shrink-0 text-ods-text-secondary size-4 md:size-6" />
        )}
        {!loading && endAdornment && (
          <span className="text-h6 flex-shrink-0 text-ods-text-secondary transition-colors duration-200 group-has-[:focus]:text-ods-accent group-data-[invalid]:text-ods-error [&_svg]:size-4 md:[&_svg]:size-6">
            {endAdornment}
          </span>
        )}
      </label>
    )

    return (
      <FieldWrapper label={label} error={error} errorVariant={errorVariant}>
        {content}
      </FieldWrapper>
    )
  }
)
Input.displayName = "Input"

export { Input };

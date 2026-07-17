"use client"

import { cn } from "../utils/cn"
import { X } from "lucide-react"

// Unified FilterChip component for consistent styling across the application
interface FilterChipProps {
  id: string
  label: string
  variant?: 'selected' | 'unselected' | 'category' | 'subcategory' | 'tag' | 'info'
  size?: 'sm' | 'md'
  removable?: boolean
  onRemove?: () => void
  onClick?: () => void
  disabled?: boolean
  className?: string
}

export function FilterChip({
  id,
  label,
  variant = 'unselected',
  size = 'md',
  removable = false,
  onRemove,
  onClick,
  disabled = false,
  className
}: FilterChipProps) {
  const baseClasses = cn(
    "inline-flex items-center justify-center rounded-full font-medium transition-all duration-200 shrink-0 group cursor-pointer",
    "hover:shadow-md hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2",
    "font-body leading-none",
    // Size variants - enhanced mobile sizing for better visibility and touch targets
    size === 'sm' 
      ? "text-sm pl-3 pr-3 py-1 md:text-sm md:pl-3 md:pr-3 md:py-1"
      : "text-sm pl-3 pr-3 py-2 md:text-sm md:pl-3 md:pr-3 md:py-2",
    // Add gap only if removable (has X button) - placed after text
    removable && "gap-1 md:gap-1",
    // Disabled state
    disabled && "opacity-50 cursor-not-allowed hover:scale-100 hover:shadow-none"
  )

  const variantClasses = {
    // Legacy variants (for backward compatibility)
    selected: "bg-ods-bg-surface text-ods-text-primary border border-ods-accent hover:bg-ods-border hover:border-ods-accent-hover focus:ring-ods-accent focus:ring-offset-ods-bg",
    unselected: "bg-ods-bg-surface text-ods-text-secondary border border-ods-border hover:bg-ods-border hover:border-ods-border-hover hover:text-ods-text-primary focus:ring-ods-border focus:ring-offset-ods-bg",
    info: "bg-ods-border text-ods-text-secondary border border-ods-border-hover cursor-default hover:scale-100 hover:shadow-none focus:ring-ods-border-hover focus:ring-offset-ods-bg",

    // New subtle selected variants - same backgrounds/text, only border colors different
    category: "bg-ods-bg-surface text-ods-text-primary border border-ods-accent/40 hover:bg-ods-border hover:border-ods-accent/60 hover:text-ods-text-primary focus:ring-ods-accent/40 focus:ring-offset-ods-bg",
    subcategory: "bg-ods-bg-surface text-ods-text-primary border border-ods-accent/60 hover:bg-ods-border hover:border-ods-accent/80 hover:text-ods-text-primary focus:ring-ods-accent/60 focus:ring-offset-ods-bg",
    tag: "bg-ods-bg-surface text-ods-text-primary border border-ods-accent/20 hover:bg-ods-border hover:border-ods-accent/30 hover:text-ods-text-primary focus:ring-ods-accent/20 focus:ring-offset-ods-bg",
  }

  return (
    <div
      className={cn(baseClasses, variantClasses[variant], className)}
      onClick={disabled ? undefined : (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      aria-pressed={onClick && variant === 'selected' ? true : undefined}
      aria-disabled={disabled}
    >
      <span className={cn(
        "truncate font-body font-medium leading-none text-center",
        size === 'sm' ? "max-w-[100px] md:max-w-[120px]" : "max-w-[120px] md:max-w-[140px]"
      )} title={label}>
        {label}
      </span>
      {removable && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!disabled) onRemove()
          }}
          disabled={disabled}
          className={cn(
            "flex items-center justify-center w-4 h-4 md:w-4 md:h-4 rounded-full",
            "transition-all duration-200 shrink-0",
            "group-hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1",
            variant === 'category'
              ? "hover:bg-ods-bg-hover text-ods-text-primary focus:ring-ods-border-focus focus:ring-offset-ods-bg-surface"
              : variant === 'subcategory'
              ? "hover:bg-ods-bg-hover text-ods-text-primary focus:ring-ods-border-focus focus:ring-offset-ods-bg-surface"
              : variant === 'tag'
              ? "hover:bg-ods-bg-hover text-ods-text-primary focus:ring-ods-border-focus focus:ring-offset-ods-bg-surface"
              : "hover:bg-ods-bg-hover text-ods-text-primary focus:ring-ods-border-focus focus:ring-offset-ods-bg-surface",
            disabled && "opacity-50 cursor-not-allowed hover:scale-100"
          )}
          aria-label={`Remove ${label} filter`}
          tabIndex={disabled ? -1 : 0}
        >
          <X className="h-2 w-2 md:h-2 md:w-2" />
        </button>
      )}
    </div>
  )
} 
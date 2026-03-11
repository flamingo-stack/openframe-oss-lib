'use client';

import { X } from 'lucide-react';
import { cn } from '../utils/cn';

// Unified FilterChip component for consistent styling across the application
interface FilterChipProps {
  id: string;
  label: string;
  variant?: 'selected' | 'unselected' | 'category' | 'subcategory' | 'tag' | 'info';
  size?: 'sm' | 'md';
  removable?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
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
  className,
}: FilterChipProps) {
  const baseClasses = cn(
    'inline-flex items-center justify-center rounded-full font-medium transition-all duration-200 shrink-0 group cursor-pointer',
    'hover:shadow-md hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2',
    "font-['DM_Sans'] leading-none",
    // Size variants - enhanced mobile sizing for better visibility and touch targets
    size === 'sm'
      ? 'text-sm pl-3 pr-3 py-1 md:text-sm md:pl-3 md:pr-3 md:py-1'
      : 'text-sm pl-3 pr-3 py-2 md:text-sm md:pl-3 md:pr-3 md:py-2',
    // Add gap only if removable (has X button) - placed after text
    removable && 'gap-1 md:gap-1',
    // Disabled state
    disabled && 'opacity-50 cursor-not-allowed hover:scale-100 hover:shadow-none',
  );

  const variantClasses = {
    // Legacy variants (for backward compatibility)
    selected:
      'bg-ods-bg-secondary text-ods-border border border-ods-open-yellow hover:bg-ods-border hover:border-ods-open-yellow-dark focus:ring-ods-open-yellow focus:ring-offset-ods-bg',
    unselected:
      'bg-ods-bg-secondary text-ods-text-secondary border border-ods-border-hover hover:bg-ods-border hover:border-ods-border-active hover:text-ods-text-primary focus:ring-ods-border-hover focus:ring-offset-ods-bg',
    info: 'bg-ods-border text-ods-text-secondary border border-ods-border-active cursor-default hover:scale-100 hover:shadow-none focus:ring-ods-border-active focus:ring-offset-ods-bg',

    // New subtle selected variants - same backgrounds/text, only border colors different
    category:
      'bg-ods-bg-secondary text-ods-border border border-ods-open-yellow/40 hover:bg-ods-border hover:border-ods-open-yellow/60 hover:text-ods-text-primary focus:ring-ods-open-yellow/40 focus:ring-offset-ods-bg',
    subcategory:
      'bg-ods-bg-secondary text-ods-border border border-ods-open-yellow/60 hover:bg-ods-border hover:border-ods-open-yellow/80 hover:text-ods-text-primary focus:ring-ods-open-yellow/60 focus:ring-offset-ods-bg',
    tag: 'bg-ods-bg-secondary text-ods-text-primary border border-ods-open-yellow/20 hover:bg-ods-border hover:border-ods-open-yellow/30 hover:text-ods-text-primary focus:ring-ods-open-yellow/20 focus:ring-offset-ods-bg',
  };

  return (
    <div
      className={cn(baseClasses, variantClasses[variant], className)}
      onClick={
        disabled
          ? undefined
          : e => {
              e.preventDefault();
              e.stopPropagation();
              onClick?.();
            }
      }
      role={onClick ? 'button' : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      aria-pressed={onClick && variant === 'selected' ? true : undefined}
      aria-disabled={disabled}
    >
      <span
        className={cn(
          "truncate font-['DM_Sans'] font-medium leading-none text-center",
          size === 'sm' ? 'max-w-[100px] md:max-w-[120px]' : 'max-w-[120px] md:max-w-[140px]',
        )}
      >
        {label}
      </span>
      {removable && onRemove && (
        <button
          type="button"
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled) onRemove();
          }}
          disabled={disabled}
          className={cn(
            'flex items-center justify-center w-4 h-4 md:w-4 md:h-4 rounded-full',
            'transition-all duration-200 shrink-0',
            'group-hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1',
            variant === 'category'
              ? 'hover:bg-ods-bg-surface-hover text-ods-border focus:ring-ods-border focus:ring-offset-ods-bg-secondary'
              : variant === 'subcategory'
                ? 'hover:bg-ods-bg-surface-hover text-ods-border focus:ring-ods-border focus:ring-offset-ods-bg-secondary'
                : variant === 'tag'
                  ? 'hover:bg-ods-bg-surface-hover text-ods-border focus:ring-ods-border focus:ring-offset-ods-bg-secondary'
                  : 'hover:bg-ods-bg-surface-hover text-ods-border focus:ring-ods-border focus:ring-offset-ods-bg-secondary',
            disabled && 'opacity-50 cursor-not-allowed hover:scale-100',
          )}
          aria-label={`Remove ${label} filter`}
          tabIndex={disabled ? -1 : 0}
        >
          <X className="h-2 w-2 md:h-2 md:w-2" />
        </button>
      )}
    </div>
  );
}

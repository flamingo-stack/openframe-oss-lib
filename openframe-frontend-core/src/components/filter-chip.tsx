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
    'group inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full font-medium transition-all duration-200',
    'hover:scale-105 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2',
    'font-body leading-none',
    // Size variants - enhanced mobile sizing for better visibility and touch targets
    size === 'sm'
      ? 'py-1 pl-3 pr-3 text-sm md:py-1 md:pl-3 md:pr-3 md:text-sm'
      : 'py-2 pl-3 pr-3 text-sm md:py-2 md:pl-3 md:pr-3 md:text-sm',
    // Add gap only if removable (has X button) - placed after text
    removable && 'gap-1 md:gap-1',
    // Disabled state
    disabled && 'cursor-not-allowed opacity-50 hover:scale-100 hover:shadow-none',
  );

  const variantClasses = {
    // Legacy variants (for backward compatibility)
    selected:
      'bg-ods-bg-surface text-ods-text-primary border border-ods-accent hover:bg-ods-border hover:border-ods-accent-hover focus:ring-ods-accent focus:ring-offset-ods-bg',
    unselected:
      'bg-ods-bg-surface text-ods-text-secondary border border-ods-border hover:bg-ods-border hover:border-ods-border-hover hover:text-ods-text-primary focus:ring-ods-border focus:ring-offset-ods-bg',
    info: 'bg-ods-border text-ods-text-secondary border border-ods-border-hover cursor-default hover:scale-100 hover:shadow-none focus:ring-ods-border-hover focus:ring-offset-ods-bg',

    // New subtle selected variants - same backgrounds/text, only border colors different
    category:
      'bg-ods-bg-surface text-ods-text-primary border border-ods-accent/40 hover:bg-ods-border hover:border-ods-accent/60 hover:text-ods-text-primary focus:ring-ods-accent/40 focus:ring-offset-ods-bg',
    subcategory:
      'bg-ods-bg-surface text-ods-text-primary border border-ods-accent/60 hover:bg-ods-border hover:border-ods-accent/80 hover:text-ods-text-primary focus:ring-ods-accent/60 focus:ring-offset-ods-bg',
    tag: 'bg-ods-bg-surface text-ods-text-primary border border-ods-accent/20 hover:bg-ods-border hover:border-ods-accent/30 hover:text-ods-text-primary focus:ring-ods-accent/20 focus:ring-offset-ods-bg',
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
          'truncate text-center font-body font-medium leading-none',
          size === 'sm' ? 'max-w-[100px] md:max-w-[120px]' : 'max-w-[120px] md:max-w-[140px]',
        )}
        title={label}
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
            'flex h-4 w-4 items-center justify-center rounded-full md:h-4 md:w-4',
            'shrink-0 transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-offset-1 group-hover:scale-110',
            variant === 'category'
              ? 'text-ods-text-primary hover:bg-ods-bg-hover focus:ring-ods-border-focus focus:ring-offset-ods-bg-surface'
              : variant === 'subcategory'
                ? 'text-ods-text-primary hover:bg-ods-bg-hover focus:ring-ods-border-focus focus:ring-offset-ods-bg-surface'
                : variant === 'tag'
                  ? 'text-ods-text-primary hover:bg-ods-bg-hover focus:ring-ods-border-focus focus:ring-offset-ods-bg-surface'
                  : 'text-ods-text-primary hover:bg-ods-bg-hover focus:ring-ods-border-focus focus:ring-offset-ods-bg-surface',
            disabled && 'cursor-not-allowed opacity-50 hover:scale-100',
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

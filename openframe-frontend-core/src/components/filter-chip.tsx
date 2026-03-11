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
      'bg-[var(--ods-system-greys-background-action)] text-[var(--color-border-default)] border border-[var(--ods-open-yellow-base)] hover:bg-ods-border hover:border-[var(--ods-open-yellow-dark)] focus:ring-[var(--ods-open-yellow-base)] focus:ring-offset-[var(--ods-system-greys-background)]',
    unselected:
      'bg-[var(--ods-system-greys-background-action)] text-[var(--ods-system-greys-grey)] border border-[var(--ods-system-greys-soft-grey-hover)] hover:bg-ods-border hover:border-[var(--ods-system-greys-soft-grey-action)] hover:text-ods-text-primary focus:ring-[var(--ods-system-greys-soft-grey-hover)] focus:ring-offset-[var(--ods-system-greys-background)]',
    info: 'bg-ods-border text-[var(--ods-system-greys-grey)] border border-[var(--ods-system-greys-soft-grey-action)] cursor-default hover:scale-100 hover:shadow-none focus:ring-[var(--ods-system-greys-soft-grey-action)] focus:ring-offset-[var(--ods-system-greys-background)]',

    // New subtle selected variants - same backgrounds/text, only border colors different
    category:
      'bg-[var(--ods-system-greys-background-action)] text-[var(--color-border-default)] border border-[var(--ods-open-yellow-base)]/40 hover:bg-ods-border hover:border-[var(--ods-open-yellow-base)]/60 hover:text-ods-text-primary focus:ring-[var(--ods-open-yellow-base)]/40 focus:ring-offset-[var(--ods-system-greys-background)]',
    subcategory:
      'bg-[var(--ods-system-greys-background-action)] text-[var(--color-border-default)] border border-[var(--ods-open-yellow-base)]/60 hover:bg-ods-border hover:border-[var(--ods-open-yellow-base)]/80 hover:text-ods-text-primary focus:ring-[var(--ods-open-yellow-base)]/60 focus:ring-offset-[var(--ods-system-greys-background)]',
    tag: 'bg-[var(--ods-system-greys-background-action)] text-ods-text-primary border border-[var(--ods-open-yellow-base)]/20 hover:bg-ods-border hover:border-[var(--ods-open-yellow-base)]/30 hover:text-ods-text-primary focus:ring-[var(--ods-open-yellow-base)]/20 focus:ring-offset-[var(--ods-system-greys-background)]',
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
              ? 'hover:bg-[var(--ods-system-greys-soft-grey-hover)] text-[var(--color-border-default)] focus:ring-[var(--color-border-default)] focus:ring-offset-[var(--ods-system-greys-background-action)]'
              : variant === 'subcategory'
                ? 'hover:bg-[var(--ods-system-greys-soft-grey-hover)] text-[var(--color-border-default)] focus:ring-[var(--color-border-default)] focus:ring-offset-[var(--ods-system-greys-background-action)]'
                : variant === 'tag'
                  ? 'hover:bg-[var(--ods-system-greys-soft-grey-hover)] text-[var(--color-border-default)] focus:ring-[var(--color-border-default)] focus:ring-offset-[var(--ods-system-greys-background-action)]'
                  : 'hover:bg-[var(--ods-system-greys-soft-grey-hover)] text-[var(--color-border-default)] focus:ring-[var(--color-border-default)] focus:ring-offset-[var(--ods-system-greys-background-action)]',
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

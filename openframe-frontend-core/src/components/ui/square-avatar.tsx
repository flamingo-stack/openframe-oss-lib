"use client"

import * as React from "react";
import Image from "next/image";
import { cn } from "../../utils/cn";

// Extract initials from a name (first letter of first and last word)
const getInitials = (name?: string): string => {
  if (!name) return '';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
};

interface SquareAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fallback?: string;
  variant?: 'square' | 'round';
}

const SquareAvatar = React.forwardRef<HTMLDivElement, SquareAvatarProps>(
  ({ className, src, alt, size = 'md', fallback, variant = 'square', ...props }, ref) => {
    const sizeClasses = {
      sm: 'h-8 w-8',
      md: 'h-10 w-10',
      lg: 'h-12 w-12',
      xl: 'h-16 w-16'
    };

    const sizePx = {
      sm: 32,
      md: 40,
      lg: 48,
      xl: 64
    };

    const variantClasses = {
      square: 'rounded-md',
      round: 'rounded-full'
    };

    return (
      <div
        className={cn(
          "relative flex items-center justify-center shrink-0 overflow-hidden border border-ods-border bg-ods-bg",
          sizeClasses[size],
          variantClasses[variant],
          className
        )}
        ref={ref}
        {...props}
      >
        <div className={cn(
          'flex items-center justify-center text-xs font-medium text-ods-text-secondary',
          src && 'hidden'
        )}>
          {getInitials(fallback || alt) || '?'}
        </div>
        {src && (
          <Image
            className="absolute inset-0 h-full w-full object-cover"
            src={src}
            alt={alt || ''}
            width={sizePx[size]}
            height={sizePx[size]}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const el = e.currentTarget.previousElementSibling as HTMLElement;
              if (el) el.classList.remove('hidden');
            }}
          />
        )}
      </div>
    )
  }
)
SquareAvatar.displayName = "SquareAvatar"

export { SquareAvatar };

"use client"

import * as React from "react";
import Image from "../../embed-shims/next-image";
import { cn } from "../../utils/cn";
import { getFirstLastInitials } from "../../utils/format";

interface SquareAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fallback?: string;
  variant?: 'square' | 'round';
  /** Override the initials-fallback styling (font size/color). Merged over the
   *  defaults (`text-xs font-medium text-ods-text-primary`) via tailwind-merge,
   *  so callers can shrink/recolor the initials for compact avatars. */
  initialsClassName?: string;
}

const SquareAvatar = React.memo(React.forwardRef<HTMLDivElement, SquareAvatarProps>(
  ({ className, src, alt, size = 'md', fallback, variant = 'square', initialsClassName, ...props }, ref) => {
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
          // Initials default to `--color-text-primary` (the old
          // `text-ods-text-primary` value) so they stay readable on the default
          // `bg-ods-bg` AND on the brand accent fills (`bg-ods-flamingo-pink`
          // for the current user, `bg-ods-flamingo-cyan` for Mingo). The color
          // resolves through `--ods-avatar-initials` with that fallback, so a
          // host themed with a custom avatar fill can override the var with a
          // contrast-correct value (e.g. `getReadableTextColor(accent)`) WITHOUT
          // regressing any avatar that leaves the var unset. A caller passing
          // its own `initialsClassName` text color still wins (tailwind-merge
          // keeps the later class).
          'flex items-center justify-center text-xs font-medium text-[color:var(--ods-avatar-initials,var(--color-text-primary))]',
          initialsClassName,
          src && 'hidden'
        )}>
          {getFirstLastInitials(fallback || alt) || '?'}
        </div>
        {src && (
          <Image
            className="absolute -inset-px h-[calc(100%+2px)] w-[calc(100%+2px)] max-w-none object-cover"
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
))
SquareAvatar.displayName = "SquareAvatar"

export { SquareAvatar };

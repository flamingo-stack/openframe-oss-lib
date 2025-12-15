import * as React from "react"
import { cn } from "../../utils/cn"

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

    const variantClasses = {
      square: 'rounded-md',
      round: 'rounded-full'
    };

    return (
      <div
        className={cn(
          "relative flex shrink-0 overflow-hidden",
          sizeClasses[size],
          variantClasses[variant],
          className
        )}
        ref={ref}
        {...props}
      >
        {src ? (
          <img
            className="aspect-square h-full w-full object-cover"
            src={src}
            alt={alt}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <span className="text-xs font-medium">
              {getInitials(fallback || alt) || '?'}
            </span>
          </div>
        )}
      </div>
    )
  }
)
SquareAvatar.displayName = "SquareAvatar"

export { SquareAvatar }
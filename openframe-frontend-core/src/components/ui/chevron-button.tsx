'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { Button } from './button';

interface ChevronButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  direction?: 'up' | 'down';
  /** `sm` and `md` are the 32px icon button, `lg` the 44/48px one. */
  size?: 'sm' | 'md' | 'lg';
  isExpanded?: boolean;
}

/** An expand / collapse toggle: a quiet icon button whose chevron points the way the section will move. */
const ChevronButton = forwardRef<HTMLButtonElement, ChevronButtonProps>(
  ({ className, direction = 'down', size = 'md', isExpanded, ...props }, ref) => {
    const pointsUp = isExpanded ?? direction === 'up';
    const Icon = pointsUp ? ChevronUp : ChevronDown;

    return (
      <Button
        ref={ref}
        type="button"
        variant="transparent"
        size={size === 'lg' ? 'icon' : 'icon-sm'}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? 'Collapse' : 'Expand'}
        className={className}
        {...props}
      >
        <Icon />
      </Button>
    );
  },
);
ChevronButton.displayName = 'ChevronButton';

export { ChevronButton };

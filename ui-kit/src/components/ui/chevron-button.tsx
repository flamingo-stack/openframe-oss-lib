import * as React from "react"
import { ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "../../utils/cn"

interface ChevronButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  direction?: 'up' | 'down';
  size?: 'sm' | 'md' | 'lg';
  isExpanded?: boolean;
  backgroundColor?: string;
  borderColor?: string;
}

const ChevronButton = React.forwardRef<HTMLButtonElement, ChevronButtonProps>(
  ({ className, direction = 'down', size = 'md', isExpanded, backgroundColor, borderColor, ...props }, ref) => {
    const Icon = (isExpanded ? ChevronUp : ChevronDown) || (direction === 'up' ? ChevronUp : ChevronDown);
    const sizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5', 
      lg: 'h-6 w-6'
    };

    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          "h-10 px-4 py-2",
          className
        )}
        style={{
          backgroundColor: backgroundColor,
          borderColor: borderColor
        }}
        ref={ref}
        {...props}
      >
        <Icon className={sizeClasses[size]} />
      </button>
    )
  }
)
ChevronButton.displayName = "ChevronButton"

export { ChevronButton }
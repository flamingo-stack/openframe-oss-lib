import * as React from "react"
import { cn } from "../../utils/cn"

interface IconsBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  icons?: string[];
  size?: 'sm' | 'md' | 'lg';
}

const IconsBlock = React.forwardRef<HTMLDivElement, IconsBlockProps>(
  ({ className, icons = [], size = 'md', ...props }, ref) => {
    const sizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-6 w-6',
      lg: 'h-8 w-8'
    };

    return (
      <div
        className={cn(
          "flex items-center gap-2",
          className
        )}
        ref={ref}
        {...props}
      >
        {icons.map((icon, index) => (
          <div
            key={index}
            className={cn(
              "rounded-md bg-secondary p-1",
              sizeClasses[size]
            )}
          >
            {/* Icon placeholder */}
            <div className="h-full w-full bg-primary/20 rounded-sm" />
          </div>
        ))}
      </div>
    )
  }
)
IconsBlock.displayName = "IconsBlock"

export { IconsBlock }
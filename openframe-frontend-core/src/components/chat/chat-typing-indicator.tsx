import * as React from "react"
import { cn } from "../../utils/cn"

export interface ChatTypingIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg'
}

const ChatTypingIndicator = React.forwardRef<HTMLDivElement, ChatTypingIndicatorProps>(
  ({ className, size = 'md', ...props }, ref) => {
    const sizeClasses = {
      sm: 'h-3 w-0.5',
      md: 'h-4 w-0.5',
      lg: 'h-5 w-1'
    }

    return (
      <div
        ref={ref}
        className={cn("flex items-center gap-0.5", className)}
        {...props}
      >
        <span className="text-ods-text-secondary text-sm">Assistant is typing</span>
        <div className={cn(
          sizeClasses[size],
          "bg-ods-text-secondary rounded-full",
          "animate-pulse-cursor"
        )} />
      </div>
    )
  }
)

ChatTypingIndicator.displayName = "ChatTypingIndicator"

export { ChatTypingIndicator }
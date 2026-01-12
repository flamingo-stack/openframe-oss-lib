import * as React from "react"
import { cn } from "../../utils/cn"

export interface ChatTypingIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  dotClassName?: string
}

const ChatTypingIndicator = React.forwardRef<HTMLDivElement, ChatTypingIndicatorProps>(
  ({ className, size = 'md', showText = false, dotClassName, ...props }, ref) => {
    const dotSizeClasses = {
      sm: 'w-1 h-1',
      md: 'w-1.5 h-1.5',
      lg: 'w-2 h-2'
    }

    const containerSizeClasses = {
      sm: 'h-4',
      md: 'h-6',
      lg: 'h-8'
    }

    const dotAnimation = `
      @keyframes dotPulse {
        0%, 80%, 100% {
          transform: scale(1);
          opacity: 0.7;
        }
        40% {
          transform: scale(1.5);
          opacity: 1;
        }
      }
    `

    return (
      <div
        ref={ref}
        className={cn("flex items-center gap-2", className)}
        {...props}
      >
        <style dangerouslySetInnerHTML={{ __html: dotAnimation }} />
        {showText && (
          <span className="text-ods-text-secondary text-sm">Assistant is typing</span>
        )}
        <div className={cn(
          "inline-flex items-center justify-center gap-1",
          containerSizeClasses[size]
        )}>
          <div 
            className={cn(
              dotSizeClasses[size],
              "rounded-full",
              dotClassName || "bg-ods-text-primary"
            )}
            style={{ 
              animation: 'dotPulse 1.4s ease-in-out infinite',
              animationDelay: '0ms' 
            }}
          />
          <div 
            className={cn(
              dotSizeClasses[size],
              "rounded-full",
              dotClassName || "bg-ods-text-primary"
            )}
            style={{ 
              animation: 'dotPulse 1.4s ease-in-out infinite',
              animationDelay: '200ms' 
            }}
          />
          <div 
            className={cn(
              dotSizeClasses[size],
              "rounded-full",
              dotClassName || "bg-ods-text-primary"
            )}
            style={{ 
              animation: 'dotPulse 1.4s ease-in-out infinite',
              animationDelay: '400ms' 
            }}
          />
        </div>
      </div>
    )
  }
)

ChatTypingIndicator.displayName = "ChatTypingIndicator"

export { ChatTypingIndicator }
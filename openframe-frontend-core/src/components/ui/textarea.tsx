import * as React from "react"

import { cn } from "../../utils/cn"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        // Layout & spacing to match Input
        "flex min-h-[80px] w-full rounded-lg border p-2",
        // Typography - EXACTLY match Input
        "text-[14px] md:text-[18px] font-medium",
        // Focus & disabled states - EXACTLY match Input
        "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ods-accent/20 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
        // Animations & touch UX
        "transition-colors duration-200 touch-manipulation",
        // Admin theme palette - EXACTLY match Input
        "bg-[#161616] border-ods-border text-ods-text-primary placeholder:text-ods-text-secondary hover:border-ods-accent/30 focus:border-ods-accent",
        // Ensure proper cursor/stacking
        "cursor-text relative z-10",
        // Textarea-specific properties
        "resize-y",
        className,
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
import * as React from "react"

import { cn } from "../utils/cn"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-ods-border bg-ods-card px-3 py-2 text-h4 placeholder:text-ods-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-ods-bg",
        "touch-manipulation", // Prevent double-tap zoom
        className,
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }

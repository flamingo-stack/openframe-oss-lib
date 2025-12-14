import * as React from "react"

import { cn } from "../../utils/cn"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** When true, renders red error border & ring */
  invalid?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, invalid = false, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        // Layout & spacing identical to VendorSelector
        "flex w-full min-h-[60px] rounded-lg border p-2",
        // Typography
        "text-[14px] md:text-[18px] font-medium",
        // File input adjustments
        "ring-offset-background file:border-0 file:bg-transparent file:text-[14px] md:file:text-[18px] file:font-medium",
        // Focus & disabled states
        "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ods-accent/20 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
        // Animations & touch UX
        "transition-colors duration-200 touch-manipulation",
        // Admin theme palette (matches VendorSelector)
        "bg-[#161616] border-ods-border text-ods-text-primary placeholder:text-ods-text-secondary hover:border-ods-accent/30 focus:border-ods-accent",
        // Ensure proper cursor/stacking
        "cursor-text relative z-10",
        invalid && "border-red-500 focus-visible:ring-red-500",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = "Input"

export { Input }
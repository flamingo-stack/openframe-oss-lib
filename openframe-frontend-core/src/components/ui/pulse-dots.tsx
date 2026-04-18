"use client"

import { forwardRef } from "react"

import { cn } from "../../utils/cn"

const dotAnimation = `
  @keyframes pulseDot {
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

export interface PulseDotsProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md'
  dotClassName?: string
}

const PulseDots = forwardRef<HTMLDivElement, PulseDotsProps>(
  ({ className, size = 'sm', dotClassName, ...props }, ref) => {
    const dotSize = size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5'
    const containerHeight = size === 'sm' ? 'h-4' : 'h-6'

    return (
      <div
        ref={ref}
        className={cn("inline-flex items-center gap-0.5", containerHeight, className)}
        {...props}
      >
        <style dangerouslySetInnerHTML={{ __html: dotAnimation }} />
        <div
          className={cn(dotSize, "rounded-full", dotClassName || "bg-ods-text-secondary")}
          style={{ animation: 'pulseDot 1.4s ease-in-out infinite', animationDelay: '0ms' }}
        />
        <div
          className={cn(dotSize, "rounded-full", dotClassName || "bg-ods-text-secondary")}
          style={{ animation: 'pulseDot 1.4s ease-in-out infinite', animationDelay: '200ms' }}
        />
        <div
          className={cn(dotSize, "rounded-full", dotClassName || "bg-ods-text-secondary")}
          style={{ animation: 'pulseDot 1.4s ease-in-out infinite', animationDelay: '400ms' }}
        />
      </div>
    )
  }
)

PulseDots.displayName = "PulseDots"

export { PulseDots }

import * as React from "react"

import { cn } from "../utils/cn"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

// Unified horizontal card for homepage category section
interface CardHorizontalProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  className?: string;
  borderLeft?: boolean;
}

export function CardHorizontal({ icon, title, description, className = '', borderLeft = true }: CardHorizontalProps) {
  return (
    <div
      className={cn(
        'w-full flex flex-row items-center gap-3 md:gap-4 bg-ods-card p-4 md:p-6 min-h-[80px]',
        borderLeft ? 'border-l border-ods-border' : '',
        className
      )}
    >
      <div className="w-5 h-5 flex-shrink-0">{icon}</div>
      <div className="flex flex-col min-w-0">
        <span className="font-medium text-sm md:text-sm text-ods-text-primary leading-tight mb-0.5 text-left">{title}</span>
        <span className="text-xs md:text-sm text-ods-text-secondary leading-tight text-left">{description}</span>
      </div>
    </div>
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }

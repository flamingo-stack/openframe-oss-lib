"use client"

import * as React from "react"
import { cn } from "../utils/cn"

interface StepsProps extends React.HTMLAttributes<HTMLDivElement> {
  currentStep: number
}

const StepsComponent = React.forwardRef<HTMLDivElement, StepsProps>(
  ({ currentStep, className, children, ...props }, ref) => {
    // Count the number of step children
    const steps = React.Children.toArray(children).filter((child) => React.isValidElement(child))

    return (
      <div ref={ref} className={cn("space-y-4", className)} {...props}>
        {React.Children.map(children, (child, index) => {
          if (!React.isValidElement(child) || child.type !== Step) {
            return child
          }

          // Clone the child with additional props
          return React.cloneElement(child as React.ReactElement<any>, {
            stepNumber: index + 1,
            isActive: currentStep === index + 1,
            isCompleted: currentStep > index + 1,
            isLast: index === steps.length - 1,
          })
        })}
      </div>
    )
  },
)
StepsComponent.displayName = "Steps"

interface StepProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  stepNumber?: number
  isActive?: boolean
  isCompleted?: boolean
  isLast?: boolean
}

const Step = React.forwardRef<HTMLDivElement, StepProps>(
  ({ title, description, stepNumber, isActive, isCompleted, isLast, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("relative flex gap-4", !isLast && "pb-8", className)} {...props}>
        {/* Line connecting steps */}
        {!isLast && <div className="absolute left-[15px] top-[30px] bottom-0 w-[1px] bg-border" />}

        {/* Step indicator */}
        <div className="relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border bg-background">
          {isCompleted ? (
            <svg
              className="h-4 w-4 text-primary"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <span className={cn("text-sm font-medium", isActive ? "text-primary" : "text-muted-foreground")}>
              {stepNumber}
            </span>
          )}
        </div>

        {/* Step content */}
        <div className="flex flex-col gap-0.5">
          <h3
            className={cn(
              "text-base font-medium",
              isActive ? "text-foreground" : "text-muted-foreground",
              isCompleted && "text-primary",
            )}
          >
            {title}
          </h3>
          {description && (
            <p className={cn("text-sm", isActive ? "text-muted-foreground" : "text-muted-foreground/60")}>
              {description}
            </p>
          )}
        </div>
      </div>
    )
  },
)
Step.displayName = "Step"

export { Step }
export { StepsComponent as Steps }

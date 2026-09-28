'use client';

import { Children, type HTMLAttributes, type ReactElement, cloneElement, forwardRef, isValidElement } from 'react';
import { cn } from '../utils/cn';

interface StepsProps extends HTMLAttributes<HTMLDivElement> {
  currentStep: number;
}

const Step = forwardRef<HTMLDivElement, StepProps>(
  ({ title, description, stepNumber, isActive, isCompleted, isLast, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('relative flex gap-4', !isLast && 'pb-8', className)} {...props}>
        {/* Line connecting steps */}
        {!isLast && <div className="absolute bottom-0 left-[15px] top-[30px] w-[1px] bg-border" />}

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
            <span className={cn('text-h6', isActive ? 'text-primary' : 'text-muted-foreground')}>{stepNumber}</span>
          )}
        </div>

        {/* Step content */}
        <div className="flex flex-col gap-0.5">
          <h3
            className={cn(
              'text-h6',
              isActive ? 'text-foreground' : 'text-muted-foreground',
              isCompleted && 'text-primary',
            )}
          >
            {title}
          </h3>
          {description && (
            <p className={cn('text-h6', isActive ? 'text-muted-foreground' : 'text-muted-foreground/60')}>
              {description}
            </p>
          )}
        </div>
      </div>
    );
  },
);

const StepsComponent = forwardRef<HTMLDivElement, StepsProps>(({ currentStep, className, children, ...props }, ref) => {
  // Count the number of step children
  const steps = Children.toArray(children).filter(child => isValidElement(child));

  return (
    <div ref={ref} className={cn('space-y-4', className)} {...props}>
      {Children.map(children, (child, index) => {
        if (!isValidElement(child) || child.type !== Step) {
          return child;
        }

        // Clone the child with additional props
        return cloneElement(child as ReactElement<StepProps>, {
          stepNumber: index + 1,
          isActive: currentStep === index + 1,
          isCompleted: currentStep > index + 1,
          isLast: index === steps.length - 1,
        });
      })}
    </div>
  );
});
StepsComponent.displayName = 'Steps';

interface StepProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  stepNumber?: number;
  isActive?: boolean;
  isCompleted?: boolean;
  isLast?: boolean;
}

Step.displayName = 'Step';

export { Step };
export { StepsComponent as Steps };

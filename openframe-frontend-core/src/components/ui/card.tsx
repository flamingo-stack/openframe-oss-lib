'use client';

import { type HTMLAttributes, type ReactNode, forwardRef } from 'react';

import { cn } from '../../utils/cn';

const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // `border` with NO color token resolves to `currentColor` — on a dark card
      // with light text that paints a WHITE outline. Every ODS surface borders
      // on `--color-border`; say so.
      'rounded-lg border border-ods-border bg-card text-card-foreground shadow-sm',
      className,
    )}
    {...props}
  />
));
Card.displayName = 'Card';

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-h2', className)} {...props} />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-muted-foreground text-h6', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
));
CardFooter.displayName = 'CardFooter';

// Unified horizontal card for homepage category section
interface CardHorizontalProps {
  icon: ReactNode;
  title: string;
  description: string;
  className?: string;
  borderLeft?: boolean;
}

export function CardHorizontal({ icon, title, description, className = '', borderLeft = true }: CardHorizontalProps) {
  return (
    <div
      className={cn(
        'flex min-h-[80px] w-full flex-row items-center gap-3 bg-ods-card p-4 md:gap-4 md:p-6',
        borderLeft ? 'border-l border-ods-border' : '',
        className,
      )}
    >
      <div className="h-5 w-5 flex-shrink-0">{icon}</div>
      <div className="flex min-w-0 flex-col">
        <span className="mb-0.5 text-left text-ods-text-primary text-h6">{title}</span>
        <span className="text-left text-ods-text-secondary text-h6">{description}</span>
      </div>
    </div>
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };

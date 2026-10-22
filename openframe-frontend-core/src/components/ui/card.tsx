'use client';

import { type HTMLAttributes, type ReactNode, forwardRef } from 'react';

import { cn } from '../../utils/cn';

/**
 * `default`: the raised card (a shadow, the card colour). `panel`: a flat ODS card surface,
 * the frame a page section draws around a block of its own (a call-to-action band, the
 * booking fold, a quote tile): small radius, the card fill, no shadow.
 */
const CARD_VARIANT_CLASS = {
  default: 'rounded-lg bg-card text-card-foreground shadow-sm',
  panel: 'rounded-md bg-ods-card text-ods-text-primary',
} as const;

export type CardVariant = keyof typeof CARD_VARIANT_CLASS;

const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }>(
  ({ className, variant = 'default', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // `border` with NO color token resolves to `currentColor` — on a dark card
        // with light text that paints a WHITE outline. Every ODS surface borders
        // on `--color-border`; say so.
        'border border-ods-border',
        CARD_VARIANT_CLASS[variant],
        className,
      )}
      {...props}
    />
  ),
);
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
        'flex min-h-[80px] w-full flex-row items-center gap-3 bg-ods-card p-4 content-md:gap-4 content-md:p-6',
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

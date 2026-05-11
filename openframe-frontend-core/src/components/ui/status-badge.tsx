"use client"

import React from 'react';
import { cn } from '../../utils/cn';
import { cva, type VariantProps } from 'class-variance-authority';

const statusBadgeVariants = cva(
  "inline-flex items-center justify-center rounded font-mono font-medium uppercase tracking-wide",
  {
    variants: {
      variant: {
        card: "px-3 py-1.5 text-sm",
        button: "px-2 py-0.5 text-[10px] leading-none",
      },
      colorScheme: {
        cyan: "bg-[var(--ods-flamingo-cyan-base)] text-ods-text-on-accent",
        pink: "bg-[var(--ods-flamingo-pink-base)] text-ods-text-on-accent",
        yellow: "bg-[var(--ods-flamingo-yellow-base)] text-ods-text-on-accent border border-[var(--ods-system-greys-black)]",
        green: "bg-[var(--ods-flamingo-green-base)] text-ods-text-on-accent",
        purple: "bg-[var(--ods-flamingo-purple-base)] text-ods-text-on-accent",
        success: "bg-[var(--ods-attention-green-success-secondary)] text-[var(--ods-attention-green-success)]",
        error: "bg-[var(--ods-attention-red-error-secondary)] text-[var(--ods-attention-red-error)]",
        warning: "bg-[var(--ods-attention-yellow-warning-secondary)] text-[var(--ods-attention-yellow-warning)]",
        default: "bg-ods-bg-secondary text-ods-text-primary",
        // Border-only variants (no background) - for task type badges
        accentBorder: "bg-transparent border-2 text-ods-accent border-ods-accent",
        errorBorder: "bg-transparent border-2 text-[var(--ods-attention-red-error)] border-[var(--ods-attention-red-error)]",
        whiteBorder: "bg-transparent border-2 text-ods-text-primary border-ods-text-primary",
      },
    },
    defaultVariants: {
      variant: "card",
      colorScheme: "default",
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  text: string;
}

function StatusBadge({
  text,
  variant,
  colorScheme,
  className,
  ...props
}: StatusBadgeProps) {
  // Outer element is `<span>` so the badge is HTML-valid in any inline
  // context (e.g. inside a markdown `<p>` next to a compact chat card,
  // or inside an `<a>`). The `inline-flex` base class in
  // `statusBadgeVariants` keeps the layout identical to the previous
  // `<div>` outer — only the element name changed.
  const renderText = () => {
    if (variant === 'button' && text.includes(' ')) {
      const words = text.split(' ');
      return (
        <span className="flex flex-col items-center justify-center text-center gap-0">
          {words.map((word, index) => (
            <span key={index} className="block">{word}</span>
          ))}
        </span>
      );
    }
    return text;
  };

  return (
    <span
      className={cn(statusBadgeVariants({ variant, colorScheme }), className)}
      {...props}
    >
      {renderText()}
    </span>
  );
}

export { StatusBadge, statusBadgeVariants };
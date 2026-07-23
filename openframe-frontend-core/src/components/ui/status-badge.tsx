"use client"

import React from 'react';
import { cn } from '../../utils/cn';
import { cva, type VariantProps } from 'class-variance-authority';

const statusBadgeVariants = cva(
  "inline-flex items-center justify-center rounded",
  {
    variants: {
      variant: {
        // The two variants are two DENSITIES, not one style at two paddings:
        // `card` is the caption-scale badge that stands on its own (14/20),
        // `button` is the dense inline stamp that must stay subordinate to
        // the row it sits in (10/12, fixed). Both are Azeret Mono uppercase.
        // Keep them on different type steps — collapsing `button` onto the
        // caption step doubled every stamp's box height (its 20px line-height
        // against the stamp's 10px), which is exactly what regressed here.
        card: "px-3 py-1.5 text-h5",
        button: "px-2 py-0.5 text-micro-label",
      },
      colorScheme: {
        cyan: "bg-[var(--ods-flamingo-cyan-base)] text-ods-text-on-accent",
        pink: "bg-[var(--ods-flamingo-pink-base)] text-ods-text-on-accent",
        yellow: "bg-ods-accent text-ods-text-on-accent border border-[var(--ods-system-greys-black)]",
        green: "bg-ods-success text-ods-text-on-accent",
        purple: "bg-ods-flamingo-pink text-ods-text-on-accent",
        success: "bg-ods-success-secondary text-ods-success",
        error: "bg-ods-error-secondary text-ods-error",
        warning: "bg-ods-warning-secondary text-ods-warning",
        default: "bg-ods-bg-surface text-ods-text-primary",
        // Border-only variants (no background) - for task type badges
        accentBorder: "bg-transparent border-2 text-ods-accent border-ods-accent",
        errorBorder: "bg-transparent border-2 text-ods-error border-ods-error",
        whiteBorder: "bg-transparent border-2 text-ods-text-primary border-ods-text-primary",
      },
    },
    defaultVariants: {
      variant: "card",
      colorScheme: "default",
    },
  }
);

/**
 * OpenFrame generation badge tint — the ONE ramp for the `gen` mode below.
 * Per product direction: the TEXT colour is constant (the full platform
 * `--ods-accent`) so every generation stays equally legible; only the BACKGROUND
 * opacity steps down (Gen1 strongest → later gens fainter). Returns the % of the
 * accent mixed into the badge background. */
export function genBadgeBgOpacity(gen: number): number {
  if (gen <= 1) return 30;
  if (gen === 2) return 18;
  return Math.max(10 - (gen - 3) * 6, 4);
}

/** Parse the whole-number gen tier out of a ClickUp Target Version label
 *  ("Gen1", "Gen1.5", "Gen2" → 1, 1, 2). Fractional gens share the tier's tint.
 *  Returns 1 when no digit is present. */
export function generationTierFromLabel(label: string | null | undefined): number {
  const m = /(\d+)/.exec(label ?? '');
  const n = m ? parseInt(m[1], 10) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  text: string;
  /**
   * When true, renders `text` verbatim on a single line, bypassing the
   * default multi-word vertical-stack behavior used by `variant="button"`.
   * Use this for compact inline contexts (e.g. chat-inline roadmap cards)
   * where the stamp-like stacked layout is undesirable.
   */
  singleLine?: boolean;
  /**
   * OpenFrame generation mode. Pass the gen number (1/2/3…) to render THIS badge
   * as a generation chip: constant full-accent text on a progressive-opacity
   * accent background (see {@link genBadgeBgOpacity}), and the `text` shown in
   * its SSOT ClickUp casing ("Gen1", not uppercased) so it matches the label
   * everywhere else in the product. Overrides `colorScheme`. The one unified
   * gen badge — do NOT build a parallel component.
   */
  gen?: number;
}

function StatusBadge({
  text,
  variant,
  colorScheme,
  className,
  singleLine,
  gen,
  style,
  ...props
}: StatusBadgeProps) {
  // Generation mode: constant full-accent text, progressive-opacity accent bg,
  // SSOT casing (textTransform:none overrides the base `uppercase`). Inline
  // style so it wins over any colorScheme class regardless of CSS source order.
  const genStyle: React.CSSProperties | undefined =
    gen != null
      ? {
          textTransform: 'none',
          color: 'var(--ods-accent)',
          backgroundColor: `color-mix(in srgb, var(--ods-accent) ${genBadgeBgOpacity(gen)}%, transparent)`,
        }
      : undefined;
  // Outer element is `<span>` so the badge is HTML-valid in any inline
  // context (e.g. inside a markdown `<p>` next to a compact chat card,
  // or inside an `<a>`). The `inline-flex` base class in
  // `statusBadgeVariants` keeps the layout identical to the previous
  // `<div>` outer — only the element name changed.
  //
  // Escape hatch: callers can pass `singleLine` to opt out of the
  // multi-word stacking applied for `variant="button"`. This is needed
  // for compact inline contexts (chat-inline roadmap cards) where the
  // default stamp-like vertical stack ("TO" / "DO") breaks layout.
  const renderText = () => {
    if (singleLine) return text;
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
      className={cn(
        statusBadgeVariants({ variant, colorScheme: gen != null ? undefined : colorScheme }),
        className,
      )}
      style={genStyle ? { ...genStyle, ...style } : style}
      {...props}
    >
      {renderText()}
    </span>
  );
}

export { StatusBadge, statusBadgeVariants };
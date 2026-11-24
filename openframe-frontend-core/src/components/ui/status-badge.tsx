'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import { cn } from '../../utils/cn';
import { UnifiedSkeleton } from '../loading/unified-skeleton';
import { useLoadingScope } from './loading-scope';

/**
 * A badge is ONE LINE, as wide as its text and never wider than its container (Material, Carbon, Primer and Polaris
 * badges alike): `w-fit` so a grid cell or a stretching flex parent cannot widen it, `max-w-full min-w-0` so a narrow
 * one shortens it with an ellipsis (the whole text is its tooltip), `whitespace-nowrap` so its words never stack.
 */
const statusBadgeVariants = cva(
  'inline-flex w-fit min-w-0 max-w-full items-center justify-center whitespace-nowrap rounded',
  {
    variants: {
      // Two densities, not one style at two paddings. Both are the ODS h5
      // label treatment (Azeret Mono 500, uppercase, -0.02em); they differ in
      // scale. Putting BOTH on `text-h5` is what regressed the stamp: at
      // 14/20 on desktop every inline badge grew ~40% and its box doubled,
      // because the caption line-height replaced `leading-none`.
      variant: {
        // Standalone badge — the ODS caption composite, unmodified.
        card: 'px-3 py-1.5 text-h5',
        // Dense inline stamp. Family, weight and casing come from the SAME h5
        // tokens as `card`; only the scale is set here, because ODS has no
        // step below the 12/14px caption and this stamp is 10px by design.
        button:
          'px-2 py-0.5 font-[family-name:var(--font-h5-family)] font-[number:var(--font-h5-weight)] uppercase tracking-[-0.02em] text-badge',
      },
      colorScheme: {
        cyan: 'bg-ods-flamingo-cyan text-ods-text-on-accent',
        pink: 'bg-ods-flamingo-pink text-ods-text-on-accent',
        yellow: 'border border-ods-border bg-ods-accent text-ods-text-on-accent',
        green: 'bg-ods-success text-ods-text-on-accent',
        purple: 'bg-ods-flamingo-pink text-ods-text-on-accent',
        // Solid and soft ODS palette fills (`BADGE_PALETTE`): tokens only, no hex.
        cyanSoft: 'bg-ods-flamingo-cyan-secondary text-ods-flamingo-cyan',
        pinkSoft: 'bg-ods-flamingo-pink-secondary text-ods-flamingo-pink',
        openYellow: 'bg-ods-open-yellow text-ods-text-on-accent',
        red: 'bg-ods-error text-ods-text-on-accent',
        success: 'bg-ods-success-secondary text-ods-success',
        error: 'bg-ods-error-secondary text-ods-error',
        warning: 'bg-ods-warning-secondary text-ods-warning',
        default: 'bg-ods-bg-surface text-ods-text-primary',
        // Border-only variants (no background) - for task type badges
        accentBorder: 'border-2 border-ods-accent bg-transparent text-ods-accent',
        errorBorder: 'border-2 border-ods-error bg-transparent text-ods-error',
        whiteBorder: 'border-2 border-ods-text-primary bg-transparent text-ods-text-primary',
      },
    },
    defaultVariants: {
      variant: 'card',
      colorScheme: 'default',
    },
  },
);

/**
 * OpenFrame generation badge tint — the ONE ramp for the `gen` mode below.
 * Per product direction: the TEXT colour is constant (the full platform
 * `--ods-accent`) so every generation stays equally legible; only the BACKGROUND
 * opacity steps down (Gen1 strongest → later gens fainter). Returns the % of the
 * accent mixed into the badge background.
 *
 * The strongest step is 10%: the text is the accent itself, so the more accent
 * the background holds the less the text stands out from it. On a card, pink on
 * 10% of itself is 4.65:1; the former 30% was 3.4:1 and 18% was 4.1:1. */
export function genBadgeBgOpacity(gen: number): number {
  if (gen <= 1) return 10;
  if (gen === 2) return 7;
  return Math.max(4 - (gen - 3), 2);
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
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof statusBadgeVariants> {
  text: string;
  /**
   * OpenFrame generation mode. Pass the gen number (1/2/3…) to render THIS badge
   * as a generation chip: constant full-accent text on a progressive-opacity
   * accent background (see {@link genBadgeBgOpacity}), and the `text` shown in
   * its SSOT ClickUp casing ("Gen1", not uppercased) so it matches the label
   * everywhere else in the product. Overrides `colorScheme`. The one unified
   * gen badge — do NOT build a parallel component.
   */
  gen?: number;
  /** The badge's text is still being read: it draws its skeleton (its own padding and type step). A loading scope does
   *  the same. */
  loading?: boolean;
  /** The text is written copy (a content-type chip, "Beta"), not read data: the badge stays real in a loading scope.
   *  `loading` still switches it. */
  staticText?: boolean;
}

/**
 * A badge while its text is read: one skeleton box with the badge's own padding and type step, its content one line
 * of that step (`box-content`: the padding adds to the line, as it does around the badge's text). `align-top`: an
 * empty inline box's baseline is its bottom edge, so on its own line it would add the line's descent below it (5 to
 * 7px taller than the badge with its text).
 */
function StatusBadgeSkeleton({ variant, className }: { variant?: 'card' | 'button' | null; className?: string }) {
  return (
    <UnifiedSkeleton
      as="span"
      className={cn(
        statusBadgeVariants({ variant, colorScheme: null }),
        'box-content h-[1lh] w-12 border-transparent align-top',
        className,
      )}
    />
  );
}

function StatusBadge({
  text,
  variant,
  colorScheme,
  className,
  gen,
  style,
  loading: loadingProp,
  staticText = false,
  ...props
}: StatusBadgeProps) {
  const inScope = useLoadingScope();
  const loading = (inScope && !staticText) || !!loadingProp;
  if (loading) return <StatusBadgeSkeleton variant={variant} className={className} />;
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
  // Outer element is `<span>` so the badge is HTML-valid in any inline context (a markdown `<p>`, an `<a>`). Its text
  // is one line, shortened with an ellipsis when the badge is narrower than it; the whole text is the tooltip.
  return (
    <span
      className={cn(statusBadgeVariants({ variant, colorScheme: gen != null ? undefined : colorScheme }), className)}
      style={genStyle ? { ...genStyle, ...style } : style}
      title={text}
      {...props}
    >
      <span className="min-w-0 truncate">{text}</span>
    </span>
  );
}

export { StatusBadge, statusBadgeVariants };

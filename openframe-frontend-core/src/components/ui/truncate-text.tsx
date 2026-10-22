'use client';

import type { ReactNode } from 'react';
import { useIsTruncated } from '../../hooks/ui/use-is-truncated';
import { cn } from '../../utils/cn';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { FloatingTooltip } from './floating-tooltip';
import { useLoadingScope } from './loading-scope';

/** ODS typography variants. Maps to the `.text-h1`…`.text-h6` utilities. */
export type TruncateTextVariant = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

/** ODS text tone. Maps to the `text-ods-text-*` colour utilities. */
export type TruncateTextTone = 'primary' | 'secondary';

export interface TruncateTextProps {
  children: string;
  /** Tooltip content; defaults to `children`. */
  tooltip?: ReactNode;
  /** Extra classes merged after the variant/tone defaults. */
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Max visible lines. `1` uses `truncate` (single-line ellipsis); higher values use `line-clamp-N`. */
  lines?: 1 | 2 | 3 | 4 | 5 | 6;
  /** ODS typography token. Default: `'h4'` (body). */
  variant?: TruncateTextVariant;
  /** ODS text tone. Default: `'primary'`. */
  tone?: TruncateTextTone;
  /** Force the monospace (heading) font family — preserves the variant's size while swapping family. */
  mono?: boolean;
  /**
   * Extra classes for the tooltip trigger wrapper — the element that becomes the
   * flex/grid item in the caller's layout (e.g. `flex-1`). Merged after the
   * built-in `min-w-0 max-w-full`, which is what lets the trigger shrink inside
   * flex rows so the text ellipsizes instead of clipping.
   */
  triggerClassName?: string;
  /**
   * Trigger wrapper element. Default `'div'`. Use `'span'` where a block element
   * is invalid HTML — inside a `<p>`, a heading, or another `<span>`; the span
   * trigger is `inline-block` so the inner truncation still measures.
   */
  as?: 'div' | 'span';
  /**
   * The text is read data still being read (a cell whose text is DERIVED from the read, so it is never empty): the
   * text is its own bar. An empty text in a loading scope is one without it.
   */
  loading?: boolean;
}

const VARIANT_CLASS: Record<TruncateTextVariant, string> = {
  h1: 'text-h1',
  h2: 'text-h2',
  h3: 'text-h3',
  h4: 'text-h4',
  h5: 'text-h5',
  h6: 'text-h6',
};

const TONE_CLASS: Record<TruncateTextTone, string> = {
  primary: 'text-ods-text-primary',
  secondary: 'text-ods-text-secondary',
};

const LINE_CLAMP_CLASS: Record<2 | 3 | 4 | 5 | 6, string> = {
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  5: 'line-clamp-5',
  6: 'line-clamp-6',
};

/**
 * Truncated text bound to the ODS typography system. Shows a `FloatingTooltip`
 * with the full value when (and only when) the content overflows.
 *
 * ```tsx
 * <TruncateText>{name}</TruncateText>                                // h4 / primary
 * <TruncateText variant="h6" tone="secondary">{email}</TruncateText> // caption
 * <TruncateText lines={3}>{description}</TruncateText>               // 3-line clamp
 * ```
 */
export function TruncateText({
  children,
  tooltip,
  className,
  side = 'top',
  lines = 1,
  variant = 'h4',
  tone = 'primary',
  mono = false,
  triggerClassName,
  as = 'div',
  loading: loadingProp = false,
}: TruncateTextProps) {
  const isMultiLine = lines > 1;
  const { ref, isTruncated } = useIsTruncated<HTMLSpanElement>(children, { multiline: isMultiLine });
  // A text still being read (empty in a loading scope, or `loading`) is its own bar, at its type step and line count.
  const loading = (useLoadingScope() && !children) || loadingProp;
  if (loading)
    return <TextLineSkeleton type={variant} lines={lines} as={as} className={cn('w-3/4', triggerClassName)} />;

  const clampClass = isMultiLine ? LINE_CLAMP_CLASS[lines as Exclude<typeof lines, 1>] : 'truncate block';

  return (
    <FloatingTooltip
      content={tooltip ?? children}
      side={side}
      disabled={!isTruncated}
      className="max-w-xs whitespace-pre-line [overflow-wrap:anywhere]"
      as={as}
      // min-w-0: a flex/grid item's automatic minimum size is content-based when
      // overflow is visible, so without this the trigger refuses to shrink and the
      // text clips with no ellipsis and no tooltip.
      triggerClassName={cn('min-w-0 max-w-full', as === 'span' && 'inline-block align-bottom', triggerClassName)}
    >
      <span
        ref={ref}
        className={cn(
          VARIANT_CLASS[variant],
          TONE_CLASS[tone],
          mono && '[font-family:var(--font-family-heading)]',
          clampClass,
          className,
        )}
      >
        {children}
      </span>
    </FloatingTooltip>
  );
}

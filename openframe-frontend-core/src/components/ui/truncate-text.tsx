'use client'

import React, { type ReactNode, useEffect, useRef, useState } from 'react'
import { cn } from '../../utils/cn'
import { FloatingTooltip } from './floating-tooltip'

/** ODS typography variants. Maps to the `.text-h1`…`.text-h6` utilities. */
export type TruncateTextVariant = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

/** ODS text tone. Maps to the `text-ods-text-*` colour utilities. */
export type TruncateTextTone = 'primary' | 'secondary'

export interface TruncateTextProps {
  children: string
  /** Tooltip content; defaults to `children`. */
  tooltip?: ReactNode
  /** Extra classes merged after the variant/tone defaults. */
  className?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Max visible lines. `1` uses `truncate` (single-line ellipsis); higher values use `line-clamp-N`. */
  lines?: 1 | 2 | 3 | 4 | 5 | 6
  /** ODS typography token. Default: `'h4'` (body). */
  variant?: TruncateTextVariant
  /** ODS text tone. Default: `'primary'`. */
  tone?: TruncateTextTone
  /** Force the monospace (heading) font family — preserves the variant's size while swapping family. */
  mono?: boolean
}

const VARIANT_CLASS: Record<TruncateTextVariant, string> = {
  h1: 'text-h1',
  h2: 'text-h2',
  h3: 'text-h3',
  h4: 'text-h4',
  h5: 'text-h5',
  h6: 'text-h6',
}

const TONE_CLASS: Record<TruncateTextTone, string> = {
  primary: 'text-ods-text-primary',
  secondary: 'text-ods-text-secondary',
}

const LINE_CLAMP_CLASS: Record<2 | 3 | 4 | 5 | 6, string> = {
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  5: 'line-clamp-5',
  6: 'line-clamp-6',
}

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
}: TruncateTextProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [isTruncated, setIsTruncated] = useState(false)
  const isMultiLine = lines > 1

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => {
      const overflows = isMultiLine
        ? el.scrollHeight > el.clientHeight + 1
        : el.scrollWidth > el.clientWidth + 1
      setIsTruncated(overflows)
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [children, isMultiLine])

  const clampClass = isMultiLine
    ? LINE_CLAMP_CLASS[lines as Exclude<typeof lines, 1>]
    : 'truncate block'

  return (
    <FloatingTooltip
      content={tooltip ?? children}
      side={side}
      disabled={!isTruncated}
      className="max-w-xs whitespace-pre-line [overflow-wrap:anywhere]"
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
  )
}

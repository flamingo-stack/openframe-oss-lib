import type * as React from 'react'
import Link from '../../embed-shims/next-link'
import { cn } from '../../utils/cn'
import { QuestionCircleIcon } from '../icons-v2-generated/signs-and-symbols/question-circle-icon'
import { CircularProgress, type CircularProgressOverflow, type CircularProgressVariant } from './circular-progress'
import { FloatingTooltip } from './floating-tooltip'
import { Tag } from './tag'

/**
 * How the percentage is rendered next to the value:
 * - `'auto'` (default): a colored `Tag` for `warning`/`error` variants, plain
 *   "(NN%)" text otherwise. Preserves the original coupling to `progressVariant`.
 * - `'plain'`: always plain "(NN%)" text, regardless of `progressVariant`. Use
 *   when you want a colored progress ring but a neutral percentage (Figma).
 * - `'tag'`: always a colored `Tag`.
 */
export type DashboardInfoCardPercentageDisplay = 'auto' | 'plain' | 'tag'

/**
 * Size of the progress ring in px. A single number sets the ring size from the
 * Tailwind `md` (800px) breakpoint up — on mobile the ring always shrinks to
 * the 24px Figma spec. The responsive form sets `base` (mobile) explicitly,
 * plus optional `md` / `lg` (1280px) overrides — e.g. `{ base: 24, lg: 56 }`
 * keeps the small ring through tablet, and `{ base: 40 }` pins 40px at every
 * breakpoint.
 */
export type DashboardInfoCardProgressSize =
  | number
  | { base: number; md?: number; lg?: number }

export interface DashboardInfoCardProps {
  title?: string
  /** Node rendered in place of the title text. Takes precedence over `title`. */
  titleSlot?: React.ReactNode
  /**
   * Tag rendered in the title row, after the title (Figma "status" variant) —
   * e.g. `<Tag variant="outline" label="AI-Assistance" />` or a TicketStatusTag.
   * Works with or without a `title`.
   */
  titleTag?: React.ReactNode
  /**
   * Icon or image shown in a bordered square slot on the left (Figma "icon"
   * variant): 32px box / 16px content on mobile, 56px box / 24px content from
   * `md` up. The passed node is stretched to fill the content area, so plain
   * icon components and `<img>` both work.
   */
  icon?: React.ReactNode
  value: string | number
  percentage?: number
  showProgress?: boolean
  progressVariant?: CircularProgressVariant
  /**
   * Controls how `percentage` is rendered (Tag vs plain text) independently of
   * the progress-ring color. Default `'auto'`. See {@link DashboardInfoCardPercentageDisplay}.
   */
  percentageDisplay?: DashboardInfoCardPercentageDisplay
  /**
   * How the progress ring treats values over 100. Forwarded to `CircularProgress`.
   * Default: `'clamp'` — existing behavior (clamped to 0–100).
   * Use `'wrap'` for overage/overflow semantics (excess rendered as a red arc).
   */
  progressOverflow?: CircularProgressOverflow
  /**
   * Size of the circular progress ring. Defaults to the Figma spec
   * `{ base: 24, md: 56 }` — 24px on mobile, 56px on tablet and desktop. A
   * number changes only the tablet/desktop size (mobile stays 24px); use
   * `{ base, md?, lg? }` for full control. Stroke width scales proportionally
   * with the size.
   */
  progressSize?: DashboardInfoCardProgressSize
  className?: string
  /**
   * Navigation URL — renders the card as a Next.js Link
   * When provided, cursor becomes pointer and hover accent styles are applied
   */
  href?: string
  /** Tooltip content shown on a question-mark icon next to the value */
  tooltip?: React.ReactNode
  /** Override the value text className (default: `text-h3 md:text-h2` per Figma) */
  valueClassName?: string
  /** Secondary text rendered beside the value (e.g. an entry/item count). */
  subValue?: React.ReactNode
}

export function DashboardInfoCard({
  title,
  titleSlot,
  titleTag,
  icon,
  value,
  percentage,
  showProgress = false,
  progressVariant,
  percentageDisplay = 'auto',
  progressOverflow,
  progressSize,
  className,
  href,
  tooltip,
  valueClassName,
  subValue
}: DashboardInfoCardProps) {
  const formattedValue = typeof value === 'number'
    ? value.toLocaleString()
    : value

  const renderPercentage = () => {
    if (percentage === undefined) return null

    const asTag =
      percentageDisplay === 'tag' ||
      (percentageDisplay === 'auto' && (progressVariant === 'warning' || progressVariant === 'error'))

    if (asTag) {
      const tagVariant =
        progressVariant === 'warning' || progressVariant === 'error'
          ? progressVariant
          : progressVariant === 'success'
            ? 'success'
            : 'grey'
      return <Tag variant={tagVariant} label={`${percentage}%`} />
    }

    return (
      <p className="text-h4 text-ods-text-secondary">
        ({percentage}%)
      </p>
    )
  }

  const renderProgress = () => {
    if (!showProgress || percentage === undefined) return null

    // Keep the ring proportionally weighted (10px stroke at the 56px default).
    const strokeFor = (size: number) => Math.max(2, Math.round((size * 10) / 56))

    const common = {
      percentage,
      variant: progressVariant,
      overflow: progressOverflow,
      showLabel: false,
    }

    // Figma spec: the mobile ring is always 24px. The default is 56px from
    // `md` (800px) up; a numeric `progressSize` overrides only that md+ size.
    const size = typeof progressSize === 'number'
      ? { base: 24, md: progressSize }
      : progressSize ?? { base: 24, md: 56 }

    // Responsive: one ring per provided breakpoint, toggled with Tailwind
    // display utilities so only one shows at a time. The class names must stay
    // static string literals — Tailwind's JIT scanner can't see
    // dynamically-built names (e.g. `${bp}:hidden`).
    const { base, md, lg } = size

    const rings: Array<{ key: string; size: number; className: string }> = [
      { key: 'base', size: base, className: md !== undefined ? 'md:hidden' : lg !== undefined ? 'lg:hidden' : '' },
    ]
    if (md !== undefined) {
      rings.push({ key: 'md', size: md, className: lg !== undefined ? 'hidden md:block lg:hidden' : 'hidden md:block' })
    }
    if (lg !== undefined) {
      rings.push({ key: 'lg', size: lg, className: 'hidden lg:block' })
    }

    return (
      <>
        {rings.map(ring => (
          <CircularProgress
            key={ring.key}
            {...common}
            size={ring.size}
            strokeWidth={strokeFor(ring.size)}
            className={ring.className}
          />
        ))}
      </>
    )
  }

  const cardContent = (
    <>
      {/* Icon slot (Figma "icon" variant): 32px box / 16px content on mobile,
          56px box / 24px content from `md` up. */}
      {icon && (
        <div className="shrink-0 size-8 md:size-14 p-[var(--spacing-system-xxs)] bg-ods-bg border border-ods-border rounded-sm flex items-center justify-center text-ods-text-primary">
          <span className="size-4 md:size-6 flex items-center justify-center [&>*]:size-full">
            {icon}
          </span>
        </div>
      )}

      {/* Content section */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Title row: caption and/or tag (Figma "status" variant) */}
        <div className="flex items-center gap-[var(--spacing-system-xxs)]">
          {titleSlot ?? (title !== undefined && (
            <p className="text-h5 text-ods-text-secondary truncate">
              {title}
            </p>
          ))}
          {titleTag}
        </div>

        {/* Value and percentage */}
        <div className="flex items-center gap-[var(--spacing-system-xs)]">
          <p className={cn("text-h3 md:text-h2 text-ods-text-primary truncate", valueClassName)}>
            {formattedValue}
          </p>
          {subValue && (
            <p className="text-h6 text-ods-text-secondary">
              {subValue}
            </p>
          )}
          {renderPercentage()}
          {tooltip && (
            <FloatingTooltip content={tooltip} side="top">
              <span className="cursor-help text-ods-text-secondary">
                <QuestionCircleIcon size={20} />
              </span>
            </FloatingTooltip>
          )}
        </div>
      </div>

      {/* Progress indicator */}
      {renderProgress()}
    </>
  )

  // Figma spec: mobile 8px padding / 8px gap / exactly 64px tall; tablet+ 16px
  // padding / 16px gap / exactly 104px tall; 6px radius. Fixed height (not
  // min-h) — with a 32px titleTag the natural content height slightly exceeds
  // the spec, and Figma's frame is fixed; items-center absorbs the difference.
  const baseClassName = 'bg-ods-card border border-ods-border rounded-md p-[var(--spacing-system-xsf)] md:p-[var(--spacing-system-m)] h-16 md:h-[104px] flex gap-[var(--spacing-system-s)] md:gap-[var(--spacing-system-m)] items-center transition-all'

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          baseClassName,
          'cursor-pointer group',
          'hover:border-ods-border-hover hover:bg-ods-card-hover',
          className
        )}
      >
        {cardContent}
      </Link>
    )
  }

  return (
    <div
      className={cn(
        baseClassName,
        className
      )}
    >
      {cardContent}
    </div>
  )
}
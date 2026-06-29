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

export interface DashboardInfoCardProps {
  title?: string
  /** Node rendered in place of the title text. Takes precedence over `title`. */
  titleSlot?: React.ReactNode
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
  className?: string
  /**
   * Navigation URL — renders the card as a Next.js Link
   * When provided, cursor becomes pointer and hover accent styles are applied
   */
  href?: string
  /** Tooltip content shown on a question-mark icon next to the value */
  tooltip?: React.ReactNode
  /** Override the value text className (default: text-h2) */
  valueClassName?: string
  /** Secondary text rendered beside the value (e.g. an entry/item count). */
  subValue?: React.ReactNode
}

export function DashboardInfoCard({
  title,
  titleSlot,
  value,
  percentage,
  showProgress = false,
  progressVariant,
  percentageDisplay = 'auto',
  progressOverflow,
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

  const cardContent = (
    <>
      {/* Content section */}
      <div className="flex-1 flex flex-col">
        {/* Title */}
        {titleSlot ?? (
          <p className="text-h5 text-ods-text-secondary">
            {title}
          </p>
        )}

        {/* Value and percentage */}
        <div className="flex items-center gap-[var(--spacing-system-xs)]">
          <p className={cn("text-h2 text-ods-text-primary", valueClassName)}>
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
      {showProgress && percentage !== undefined && (
        <CircularProgress
          percentage={percentage}
          variant={progressVariant}
          overflow={progressOverflow}
          showLabel={false}
        />
      )}
    </>
  )

  const baseClassName = 'bg-ods-card border border-ods-border rounded-sm p-[var(--spacing-system-m)] flex gap-[var(--spacing-system-s)] items-center transition-all'

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
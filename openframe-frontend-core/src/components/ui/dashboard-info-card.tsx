import type * as React from 'react'
import Link from 'next/link'
import { cn } from '../../utils/cn'
import { QuestionCircleIcon } from '../icons-v2-generated/signs-and-symbols/question-circle-icon'
import { CircularProgress, type CircularProgressOverflow, type CircularProgressVariant } from './circular-progress'
import { FloatingTooltip } from './floating-tooltip'
import { Tag } from './tag'

export interface DashboardInfoCardProps {
  title: string
  value: string | number
  percentage?: number
  showProgress?: boolean
  progressVariant?: CircularProgressVariant
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
}

export function DashboardInfoCard({
  title,
  value,
  percentage,
  showProgress = false,
  progressVariant,
  progressOverflow,
  className,
  href,
  tooltip,
  valueClassName
}: DashboardInfoCardProps) {
  const formattedValue = typeof value === 'number'
    ? value.toLocaleString()
    : value

  const cardContent = (
    <>
      {/* Content section */}
      <div className="flex-1 flex flex-col">
        {/* Title */}
        <p className="text-h5 text-ods-text-secondary">
          {title}
        </p>

        {/* Value and percentage */}
        <div className="flex items-center gap-[var(--spacing-system-xs)]">
          <p className={cn("text-h2 text-ods-text-primary", valueClassName)}>
            {formattedValue}
          </p>
          {percentage !== undefined && (
            progressVariant === 'warning' || progressVariant === 'error' ? (
              <Tag variant={progressVariant} label={`${percentage}%`} />
            ) : (
              <p className="text-h4 text-ods-text-secondary">
                ({percentage}%)
              </p>
            )
          )}
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
          'hover:border-ods-accent',
          '[&:hover_.text-ods-text-primary]:text-ods-accent',
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
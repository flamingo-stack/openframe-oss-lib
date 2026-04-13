import type * as React from 'react'
import Link from 'next/link'
import { cn } from '../../utils/cn'
import { QuestionCircleIcon } from '../icons-v2-generated/signs-and-symbols/question-circle-icon'
import { CircularProgress } from './circular-progress'
import { FloatingTooltip } from './floating-tooltip'

export interface DashboardInfoCardProps {
  title: string
  value: string | number
  percentage?: number
  showProgress?: boolean
  progressColor?: string
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
  progressColor,
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
        <p className="text-h5 text-ods-text-secondary tracking-[-0.28px]">
          {title}
        </p>

        {/* Value and percentage */}
        <div className="flex items-center gap-2">
          <p className={cn("text-h2 text-ods-text-primary tracking-[-0.64px]", valueClassName)}>
            {formattedValue}
          </p>
          {percentage !== undefined && (
            <p className="text-h4 text-ods-text-secondary">
              {percentage}%
            </p>
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
          color={progressColor}
        />
      )}
    </>
  )

  const baseClassName = 'bg-ods-card border border-ods-border rounded-[6px] p-4 flex gap-3 items-center transition-all'

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
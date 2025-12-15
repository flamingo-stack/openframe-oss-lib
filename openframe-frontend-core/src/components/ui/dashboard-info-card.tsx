'use client'

import React from 'react'
import Link from 'next/link'
import { cn } from '../../utils/cn'
import { CircularProgress } from './circular-progress'
import { InteractiveCard } from './interactive-card'

interface DashboardInfoCardProps {
  title: string
  value: string | number
  percentage?: number
  showProgress?: boolean
  progressColor?: string
  className?: string
  onClick?: () => void
  /**
   * Navigation URL (uses Next.js Link for client-side navigation)
   * If both href and onClick are provided, href takes precedence
   */
  href?: string
  /**
   * Open link in new tab (only applies when href is provided)
   */
  openInNewTab?: boolean
}

export function DashboardInfoCard({
  title,
  value,
  percentage,
  showProgress = false,
  progressColor,
  className,
  onClick,
  href,
  openInNewTab = false
}: DashboardInfoCardProps) {
  const formattedValue = typeof value === 'number'
    ? value.toLocaleString()
    : value

  // Card content (reused in both Link and InteractiveCard)
  const cardContent = (
    <>
      {/* Content section */}
      <div className="flex-1 flex flex-col">
        {/* Title */}
        <p className="font-['Azeret_Mono'] font-medium text-[14px] leading-[20px] text-ods-text-secondary uppercase tracking-[-0.28px]">
          {title}
        </p>

        {/* Value and percentage */}
        <div className="flex items-center gap-2">
          <p className="font-['Azeret_Mono'] font-semibold text-[32px] leading-[40px] text-ods-text-primary tracking-[-0.64px]">
            {formattedValue}
          </p>
          {percentage !== undefined && (
            <p className="font-['DM_Sans'] font-medium text-[18px] leading-[24px] text-ods-text-secondary">
              {percentage}%
            </p>
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

  // If href is provided, render as Link with InteractiveCard styling
  if (href) {
    return (
      <Link
        href={href}
        target={openInNewTab ? '_blank' : undefined}
        rel={openInNewTab ? 'noopener noreferrer' : undefined}
        className={cn(
          'bg-ods-card border border-ods-border rounded-[6px] p-4 flex gap-3 items-center',
          'cursor-pointer transition-all group',
          'hover:border-ods-accent',
          '[&:hover_h3]:text-ods-accent',
          '[&:hover_.text-ods-text-primary]:text-ods-accent',
          className
        )}
      >
        {cardContent}
      </Link>
    )
  }

  // Otherwise, render as InteractiveCard with onClick
  return (
    <InteractiveCard
      onClick={onClick}
      className={cn(
        'bg-ods-card border border-ods-border rounded-[6px] p-4 flex gap-3 items-center',
        className
      )}
    >
      {cardContent}
    </InteractiveCard>
  )
}
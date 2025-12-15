'use client'

import React from 'react'
import { cn } from '../../../utils/cn'

export interface AIWarningsSectionProps {
  warnings: string[]
  title?: string
  className?: string
}

export const AIWarningsSection: React.FC<AIWarningsSectionProps> = ({
  warnings,
  title = 'AI Warnings',
  className,
}) => {
  if (!warnings || warnings.length === 0) {
    return null
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4',
        className
      )}
    >
      <div className="flex items-start gap-2">
        <svg
          className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-yellow-500 mb-2">
            {title}
          </h4>
          <ul className="space-y-1">
            {warnings.map((warning, index) => (
              <li
                key={index}
                className="text-sm text-yellow-500/80 list-disc list-inside"
              >
                {warning}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

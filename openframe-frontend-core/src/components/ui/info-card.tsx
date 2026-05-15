'use client'

import React from 'react'
import { cn } from '@/utils'
import { Copy01Icon } from '../icons-v2-generated/documents'
import { CheckIcon } from '@/components/icons-v2-generated'
import { useCopyToClipboard } from '@/hooks'
import { ProgressBar } from '@/components'

interface InfoCardData {
  title?: string
  subtitle?: string
  icon?: React.ReactNode
  items: Array<{
    label?: string
    value: string | string[]
    copyable?: boolean
  }>
  progress?: {
    value: number
    warningThreshold?: number
    criticalThreshold?: number
    inverted?: boolean  // if true, high values are good (green), low values are bad (red)
  }
}

interface InfoCardProps {
  data: InfoCardData
  className?: string
}

export function InfoCard({ data, className = '' }: InfoCardProps) {
  return (
    <div
      className={cn(
        'bg-ods-card border border-ods-border rounded-md p-[var(--spacing-system-m)] flex flex-col gap-[var(--spacing-system-s)] items-start w-full',
        className,
      )}
    >
      {data.title && (
        <div className="flex items-center gap-[var(--spacing-system-xsf)] self-stretch h-6">
          <span className="text-h4 text-ods-text-primary truncate">
            {data.title}
          </span>
          {data.icon}
        </div>
      )}

      {/* Subtitle */}
      {data.subtitle && (
        <div className="text-h4 text-ods-text-secondary truncate self-stretch">
          {data.subtitle}
        </div>
      )}

      {/* Info items */}
      {data.items.map((item, index) => {
        const values = Array.isArray(item.value) ? item.value : [item.value]

        return (
          <React.Fragment key={index}>
            {values.map((val, valIndex) => (
              <InfoCardValueRow
                key={`${index}-${valIndex}`}
                label={item.label}
                value={val}
                showLabel={valIndex === 0}
                copyable={item.copyable}
                copyAriaLabel={`Copy ${item.label} ${valIndex + 1}`}
              />
            ))}
          </React.Fragment>
        )
      })}

      {/* Progress bar */}
      {data.progress && (
        <ProgressBar
          progress={data.progress.value}
          warningThreshold={data.progress.warningThreshold}
          criticalThreshold={data.progress.criticalThreshold}
          inverted={data.progress.inverted}
        />
      )}
    </div>
  )
}

interface InfoCardValueRowProps {
  label?: string
  value: string
  showLabel: boolean
  copyable?: boolean
  copyAriaLabel: string
}

function InfoCardValueRow({ label, value, showLabel, copyable, copyAriaLabel }: InfoCardValueRowProps) {
  const { copy, copied } = useCopyToClipboard()

  return (
    <div className="flex h-6 items-center gap-[var(--spacing-system-xs)] self-stretch w-full">
      <span className="text-h4 text-ods-text-primary whitespace-nowrap">
        {showLabel ? label : ''}
      </span>
      <div className="flex-1 h-px bg-ods-divider" />
      <div className="flex items-center gap-[var(--spacing-system-xsf)] max-w-[60%]">
        <span
          className="text-h4 text-ods-text-primary truncate select-text"
          title={value}
        >
          {value}
        </span>
        {copyable && (
          <button
            type="button"
            onClick={() => copy(value)}
            className={cn(
              'transition-colors',
              copied ? 'text-ods-success' : 'text-ods-text-secondary hover:text-ods-text-primary',
            )}
            aria-label={copyAriaLabel}
          >
            {copied ? <CheckIcon size={16} /> : <Copy01Icon size={16} />}
          </button>
        )}
      </div>
    </div>
  )
}

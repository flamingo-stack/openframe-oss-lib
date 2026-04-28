'use client'

import React from 'react'
import { cn } from '../../utils/cn'
import { Copy01Icon } from '../icons-v2-generated/documents'
import { CheckIcon } from '../icons-v2-generated/signs-and-symbols'
import { useCopyToClipboard } from '../../hooks/use-copy-to-clipboard'
import { ProgressBar } from './progress-bar'

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
    <div className={`bg-[#212121] border border-[#3a3a3a] rounded-[6px] p-4 flex flex-col ${className}`}>
      {/* Title */}
      {data.title && (
        <div className="flex flex-col justify-center shrink-0 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-h4 text-ods-text-primary truncate">
              {data.title}
            </span>
            {data.icon}
          </div>
        </div>
      )}

      {/* Subtitle */}
      {data.subtitle && (
        <div className="text-h4 text-[#888888] truncate mb-3">
          {data.subtitle}
        </div>
      )}

      {/* Info items */}
      <div className="flex flex-col gap-2">
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
      </div>

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
    <div className="flex gap-2 items-center w-full">
      <span className="text-h4 text-[#fafafa] whitespace-nowrap">
        {showLabel ? label : ''}
      </span>
      <div className="flex-1 h-px bg-[#3a3a3a]" />
      <div className="flex items-center gap-2 max-w-[60%]">
        <span
          className="text-h4 text-[#fafafa] truncate select-text"
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
              copied ? 'text-ods-success' : 'text-[#888888] hover:text-[#fafafa]',
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

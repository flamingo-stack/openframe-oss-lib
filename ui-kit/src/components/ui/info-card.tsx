'use client'

import React from 'react'
import { CopyIcon } from '../icons'
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
            <span className="font-['DM_Sans'] font-medium text-[18px] leading-[24px] text-ods-text-primary truncate">
              {data.title}
            </span>
            {data.icon}
          </div>
        </div>
      )}

      {/* Subtitle */}
      {data.subtitle && (
        <div className="font-['DM_Sans'] font-medium text-[18px] text-[#888888] leading-[24px] truncate mb-3">
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
                <div key={`${index}-${valIndex}`} className="flex gap-2 items-center w-full">
                  <span className="font-['DM_Sans'] font-medium text-[18px] text-[#fafafa] leading-[24px] whitespace-nowrap">
                    {valIndex === 0 ? item.label : ''}
                  </span>
                  <div className="flex-1 h-px bg-[#3a3a3a]" />
                  <div className="flex items-center gap-2 max-w-[60%]">
                    <span
                      className="font-['DM_Sans'] font-medium text-[18px] text-[#fafafa] leading-[24px] truncate select-text"
                      title={val}
                    >
                      {val}
                    </span>
                    {item.copyable && (
                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(val)}
                        className="text-[#888888] hover:text-[#fafafa] transition-colors"
                        aria-label={`Copy ${item.label} ${valIndex + 1}`}
                      >
                        <CopyIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
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

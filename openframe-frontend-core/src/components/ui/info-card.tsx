'use client'

import React from 'react'
import { cn } from '../../utils/cn'
import { Copy01Icon } from '../icons-v2-generated/documents'
import { CheckIcon } from '../icons-v2-generated'
import { useCopyToClipboard } from '../../hooks'
import { ProgressBar } from './progress-bar'

export interface InfoCardFooterData {
  /** Leading icon next to the text, expected at 24x24 (e.g. <ShieldCheckIcon size={24} />) */
  icon?: React.ReactNode
  text: string
  /** Trailing icon/logo aligned to the right edge, expected at 24x24 */
  logo?: React.ReactNode
  /** External resource link rendered below the text row */
  link?: {
    href: string
    /** Defaults to href without the protocol */
    label?: string
  }
}

export interface InfoCardData {
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
  /** Optional footer rendered below the content, separated by a divider line */
  footer?: InfoCardFooterData
}

interface InfoCardProps {
  data: InfoCardData
  className?: string
}

export function InfoCard({ data, className = '' }: InfoCardProps) {
  return (
    <div
      className={cn(
        'bg-ods-card border border-ods-border rounded-md overflow-hidden flex flex-col w-full',
        className,
      )}
    >
      <div className="p-[var(--spacing-system-m)] flex flex-col gap-[var(--spacing-system-s)] items-start w-full">
        {data.title && (
          <div className="flex items-center gap-[var(--spacing-system-xsf)] self-stretch h-6">
            <span className="text-h4 text-ods-text-primary truncate" title={data.title}>
              {data.title}
            </span>
            {data.icon}
          </div>
        )}

        {/* Subtitle */}
        {data.subtitle && (
          <div className="text-h4 text-ods-text-secondary truncate self-stretch" title={data.subtitle}>
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

      {/* Footer */}
      {data.footer && <InfoCardFooter footer={data.footer} />}
    </div>
  )
}

function InfoCardFooter({ footer }: { footer: InfoCardFooterData }) {
  return (
    <div className="border-t border-ods-border p-[var(--spacing-system-m)] flex flex-col w-full">
      <div className="flex items-center justify-between gap-1 w-full">
        <div className="flex items-center gap-1">
          {footer.icon}
          <span className="text-h4 text-ods-text-primary">{footer.text}</span>
        </div>
        {footer.logo}
      </div>
      {footer.link && (
        <a
          href={footer.link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-h6 text-ods-text-secondary underline truncate hover:text-ods-text-primary"
        >
          {footer.link.label ?? footer.link.href.replace(/^https?:\/\//, '')}
        </a>
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

'use client'

import React, { useMemo, useState } from 'react'
import { cn } from '../../utils/cn'
import { CopyIcon, EyeIcon } from '../icons'
import { ExternalLink } from 'lucide-react'
import { OpenFrameLogo } from '../..'

export type ServiceCardRowAction = {
  copy?: boolean
  open?: boolean
  reveal?: boolean
}

export type ServiceCardRow = {
  label?: string
  value: string
  href?: string
  copyValue?: string
  isSecret?: boolean
  monospace?: boolean
  actions?: ServiceCardRowAction
}

export type ServiceCardTag = {
  label: string
}

export interface ServiceCardProps {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  tag?: ServiceCardTag
  rows: ServiceCardRow[]
  className?: string
}

function MaskedValue({ value, isRevealed }: { value: string; isRevealed: boolean }) {
  if (isRevealed) return <span>{value}</span>
  return <span>{'•'.repeat(Math.min(value.length, 12))}</span>
}

export function ServiceCard({ title, subtitle, icon, tag, rows, className }: ServiceCardProps) {
  const resolvedIcon = icon ?? (
    <OpenFrameLogo 
      className="w-10 h-10"
      lowerPathColor={'var(--color-accent-primary)'}
      upperPathColor={'var(--color-text-primary)'}
    />
  )

  return (
    <div className={cn('bg-ods-card border border-ods-border rounded-lg p-6', className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 flex items-center justify-center bg-ods-bg rounded-md border border-ods-border flex-shrink-0">
            {resolvedIcon}
          </div>
          <div className="min-w-0">
            <div className="text-xl font-semibold text-ods-text-primary truncate">{title}</div>
            {subtitle && (
              <div className="text-sm text-ods-text-secondary truncate">{subtitle}</div>
            )}
          </div>
        </div>
        {tag && (
          <div className="px-3 py-1 rounded-full bg-ods-bg text-ods-text-primary text-xs font-semibold whitespace-nowrap self-start border border-ods-border">
            {tag.label}
          </div>
        )}
      </div>

      {/* Rows */}
      <div className="space-y-3">
        {rows.map((row, idx) => (
          <ServiceCardRowItem key={idx} row={row} />
        ))}
      </div>
    </div>
  )
}

function ServiceCardRowItem({ row }: { row: ServiceCardRow }) {
  const [revealed, setRevealed] = useState(false)
  const actions = useMemo<ServiceCardRowAction>(() => ({ copy: true, open: !!row.href, reveal: !!row.isSecret, ...row.actions }), [row])

  const displayValue = row.isSecret ? <MaskedValue value={row.value} isRevealed={revealed} /> : <span>{row.value}</span>

  const copyToClipboard = async () => {
    const text = row.copyValue ?? row.value
    try { await navigator.clipboard.writeText(text) } catch { /* no-op */ }
  }

  const openInNewTab = () => {
    if (!row.href) return
    window.open(row.href, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex items-center gap-3 min-w-0">
      {row.label && (
        <div className="w-20 sm:w-24 shrink-0 text-sm font-medium text-ods-text-primary">{row.label}</div>
      )}
      <div className={cn('flex-1 h-12 rounded-md border border-ods-border bg-ods-bg px-3 sm:px-4 flex items-center justify-between min-w-0', row.monospace ? 'font-mono' : '')}>
        <div className="truncate text-ods-text-primary min-w-0">{displayValue}</div>
        <div className="flex items-center gap-2 pl-3 flex-shrink-0">
          {actions.reveal && (
            <button
              onClick={() => setRevealed(v => !v)}
              className="p-2 rounded hover:bg-ods-card text-ods-text-secondary"
              aria-label={revealed ? 'Hide' : 'Reveal'}
            >
              <EyeIcon className="w-5 h-5" off={revealed} />
            </button>
          )}

          {actions.copy && (
            <button
              onClick={copyToClipboard}
              className="p-2 rounded hover:bg-ods-card text-ods-text-secondary"
              aria-label={`Copy ${row.label ?? 'value'}`}
            >
              <CopyIcon className="w-5 h-5" />
            </button>
          )}

          {actions.open && row.href && (
            <button
              onClick={openInNewTab}
              className="p-2 rounded hover:bg-ods-card text-ods-text-secondary"
              aria-label={`Open ${row.label ?? 'link'}`}
            >
              <ExternalLink className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

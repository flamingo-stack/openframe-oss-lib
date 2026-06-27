'use client'

import { AlertTriangle } from 'lucide-react'
import React from 'react'
import { cn } from '../../utils/cn'

export interface WarningBlockProps {
  /** Text rendered inside the highlighted warning banner header. */
  title: React.ReactNode
  /**
   * Icon shown at the start of the banner. Defaults to a triangle alert icon.
   * Pass `null` to hide the icon entirely.
   */
  icon?: React.ReactNode
  /**
   * Body content rendered below the banner — description paragraphs, one or more
   * `PathsDisplay` lists, command rows, etc. Fully composable so a single block
   * can mix text and multiple path groups (see the New Device warning blocks).
   */
  children?: React.ReactNode
  /** Extra classes for the outer card container. */
  className?: string
}

const DEFAULT_ICON = <AlertTriangle className="h-6 w-6" />

/**
 * WarningBlock - a card with a highlighted "attention / warning" banner header
 * followed by arbitrary body content.
 *
 * The banner reproduces the ODS warning callout (warning color on a muted
 * warning background). Body content is fully composable: pass description
 * paragraphs, one or more `PathsDisplay` lists, command rows, etc. as children.
 *
 * Spacing follows the ODS scale: card padding 16px / gap 12px, banner padding
 * 12px / gap 16px. Typography uses `text-h3`, which is responsive (14px on
 * mobile, 18px from `md` up) and bold by design-token default.
 */
export function WarningBlock({ title, icon = DEFAULT_ICON, children, className }: WarningBlockProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-[6px] border border-ods-border bg-ods-card p-4',
        className
      )}
    >
      <div className="flex items-start gap-4 overflow-hidden rounded-[6px] bg-ods-warning-secondary p-3 text-ods-warning">
        {icon != null && <span className="shrink-0">{icon}</span>}
        <p className="min-w-0 flex-1 text-h3">{title}</p>
      </div>
      {children}
    </div>
  )
}

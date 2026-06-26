'use client'

import * as React from 'react'
import Link from '../../embed-shims/next-link'
import { cn } from '../../utils/cn'
import { AssigneeDropdown, type AssigneeDropdownProps } from './assignee-dropdown'
import { SquareAvatar } from './square-avatar'
import { TicketStatusTag, type TicketStatusTagProps } from './ticket-status-tag'

/** A plain-text value, optionally with a trailing image (avatar), leading icon, or click action. */
export interface InfoSectionTextValue {
  type?: 'text'
  text: string
  /** Image shown after the text (e.g. a user or organization avatar). */
  imageSrc?: string
  /** Initials shown when the image is missing or fails to load. Defaults to `text`. */
  imageFallback?: string
  /** Avatar shape. Defaults to `round`. */
  imageVariant?: 'square' | 'round'
  /** Icon shown before the text. */
  icon?: React.ReactNode
  /** Renders the text as a button; on hover it takes the accent color. */
  onClick?: () => void
  /**
   * Renders the text as a link (Next.js `Link`). Takes precedence over `onClick`.
   * A regular click navigates in the same tab; the browser's native new-tab
   * affordances (cmd/ctrl-click, "open in new tab") work as usual.
   */
  href?: string
  /** Force the link to always open in a new tab (sets `target="_blank"`). */
  openInNewTab?: boolean
}

/** An inline assignee picker (autocomplete with search). Defaults to the `compact` variant. */
export type InfoSectionAssigneeValue = { type: 'assignee' } & AssigneeDropdownProps

/** An inline status changer (dropdown). Pass `options` + `onSelect` to make it interactive. */
export type InfoSectionStatusValue = { type: 'status' } & TicketStatusTagProps

/** Arbitrary value content. */
export interface InfoSectionCustomValue {
  type: 'custom'
  content: React.ReactNode
}

export type InfoSectionValue =
  | InfoSectionTextValue
  | InfoSectionAssigneeValue
  | InfoSectionStatusValue
  | InfoSectionCustomValue

export interface InfoSectionRow {
  /** Stable key for the row. */
  id: string
  /** Left-side label. */
  label: string
  /** Right-side value: text (with optional image), assignee picker, status dropdown, or custom node. */
  value: InfoSectionValue
}

export interface InfoSectionProps {
  /** Optional caption rendered above the card (e.g. "Ticket Details"). */
  title?: string
  rows: InfoSectionRow[]
  className?: string
}

function TextValue({ value }: { value: InfoSectionTextValue }) {
  const { text, imageSrc, imageFallback, imageVariant = 'round', icon, onClick, href, openInNewTab } = value
  const hasImage = imageSrc !== undefined || imageFallback !== undefined
  const interactiveClass = 'truncate text-left text-h4 text-ods-text-primary transition-colors hover:text-ods-accent'
  return (
    <>
      {icon && (
        <span className="flex size-4 shrink-0 items-center justify-center text-ods-text-secondary">{icon}</span>
      )}
      {href ? (
        <Link
          href={href}
          target={openInNewTab ? '_blank' : undefined}
          rel={openInNewTab ? 'noopener noreferrer' : undefined}
          title={text}
          className={interactiveClass}
        >
          {text}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} title={text} className={interactiveClass}>
          {text}
        </button>
      ) : (
        <span className="truncate text-h4 text-ods-text-primary" title={text}>
          {text}
        </span>
      )}
      {hasImage && (
        <SquareAvatar
          src={imageSrc}
          alt={text}
          fallback={imageFallback ?? text}
          size="sm"
          variant={imageVariant}
          className="h-4 w-4"
        />
      )}
    </>
  )
}

function RowValue({ value }: { value: InfoSectionValue }) {
  switch (value.type) {
    case 'assignee': {
      const { type: _type, ...props } = value
      return <AssigneeDropdown {...props} variant={props.variant ?? 'compact'} />
    }
    case 'status': {
      const { type: _type, ...props } = value
      return <TicketStatusTag {...props} />
    }
    case 'custom':
      return <>{value.content}</>
    default:
      return <TextValue value={value} />
  }
}

/**
 * A labelled info card: a vertical stack of `label —— value` rows inside a
 * bordered card, with an optional uppercase caption above it. Each row's value
 * is configurable — plain text (with an optional trailing image), an inline
 * assignee picker (autocomplete with search), an inline status dropdown, or an
 * arbitrary node.
 */
export function InfoSection({ title, rows, className }: InfoSectionProps) {
  return (
    <div className={cn('flex flex-col gap-[var(--spacing-system-xxs)]', className)}>
      {title && <p className="text-h5 text-ods-text-secondary">{title}</p>}
      <div className="flex flex-col gap-[var(--spacing-system-xsf)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-mf)]">
        {rows.map(row => (
          <div key={row.id} className="flex w-full min-w-0 items-center gap-[var(--spacing-system-xsf)]">
            <span className="shrink-0 text-h4 text-ods-text-secondary">{row.label}</span>
            <div className="h-px min-w-4 flex-1 bg-ods-border" />
            <div className="flex min-w-0 items-center gap-[var(--spacing-system-xsf)]">
              <RowValue value={row.value} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'
import { ExternalLinkIcon } from '../icons-v2-generated'
import { Button } from '../ui/button'
import { SquareAvatar } from '../ui/square-avatar'

export interface MspOrganizationCardProps {
  /** MSP/organization name. Woven into the default title: "Your IT is managed by {name}". */
  name: string
  /** Organization website shown beneath the title (e.g. "www.techflow.com"). */
  website?: string
  /** Organization logo URL. Falls back to initials derived from `name` when absent. */
  logoUrl?: string
  /** Full title override. Defaults to `Your IT is managed by {name}`. */
  title?: React.ReactNode
  /**
   * Website link. When set, the trailing action renders as an anchor
   * (`<a href target="_blank">`). Takes precedence over `onOpenWebsite`.
   */
  href?: string
  /** Click handler for the trailing action (used when `href` is not set). */
  onOpenWebsite?: () => void
  /** Appended to the root element. */
  className?: string
}

/**
 * MSP Organization card for the AI Assistant welcome screen.
 *
 * A horizontal card — square org logo, "Your IT is managed by {name}" title with
 * the website beneath, and a trailing external-link button — so users can confirm
 * which organization they are signing into. Mirrors Figma `openframe — fae-chat`
 * (node 1:5540) using ODS tokens.
 *
 * The trailing button renders only when `href` or `onOpenWebsite` is provided:
 * `href` becomes an anchor (new tab), otherwise `onOpenWebsite` fires on click.
 */
export function MspOrganizationCard({
  name,
  website,
  logoUrl,
  title,
  href,
  onOpenWebsite,
  className,
}: MspOrganizationCardProps) {
  const actionLabel = website ? `Open ${website}` : 'Open organization website'

  return (
    <div
      className={cn(
        // Inset ring (box-shadow) instead of `border` so the 1px stroke does not
        // add to the box height — matches Figma's 80px frame (16 + 48 + 16) with
        // its inside-aligned stroke. A real border would render 82px.
        'flex items-start gap-[var(--spacing-system-m)] rounded-md bg-ods-bg p-[var(--spacing-system-m)] ring-1 ring-inset ring-ods-border',
        className,
      )}
    >
      <SquareAvatar src={logoUrl} alt={name} fallback={name} size="lg" variant="square" />

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-h3 text-ods-text-primary">{title ?? `Your IT is managed by ${name}`}</span>
        {website ? <span className="truncate text-h4 text-ods-text-secondary">{website}</span> : null}
      </div>

      {href ? (
        <Button asChild variant="outline" size="icon" aria-label={actionLabel}>
          <a href={href} target="_blank" rel="noreferrer noopener">
            <ExternalLinkIcon />
          </a>
        </Button>
      ) : onOpenWebsite ? (
        <Button variant="outline" size="icon" aria-label={actionLabel} onClick={onOpenWebsite}>
          <ExternalLinkIcon />
        </Button>
      ) : null}
    </div>
  )
}

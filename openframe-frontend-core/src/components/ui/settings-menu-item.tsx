'use client'

/**
 * `<SettingsMenuItem />` — a clickable link row: a leading icon tile, a
 * title + caption column, and a trailing chevron. The whole card is a
 * single anchor (`href`). Title and caption each truncate to one line.
 *
 * Figma: openframe help-center `settings-menu-item` (node 5:2155).
 */

import type { ReactNode } from 'react'
import Link from '../../embed-shims/next-link'
import { Chevron02RightIcon } from '../icons-v2-generated/arrows/chevron-02-right-icon'
import { cn } from '../../utils/cn'

export interface SettingsMenuItemProps {
  /** Bold primary line. Truncates to one line. */
  title: string
  /** Secondary caption below the title. Truncates to one line. */
  caption: string
  /** Leading icon, rendered inside a 48px tile at 24px. Use an
   *  `icons-v2` glyph that inherits `currentColor`. */
  icon: ReactNode
  /** Destination — the whole card is this anchor. */
  href: string
  className?: string
}

export function SettingsMenuItem({ title, caption, icon, href, className }: SettingsMenuItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-[var(--spacing-system-sf)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-sf)]',
        'transition-colors hover:border-ods-border-hover',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus',
        className,
      )}
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded border border-ods-border bg-ods-bg p-1 text-ods-text-primary [&_svg]:size-6">
        {icon}
      </span>

      <span className="flex min-w-0 flex-1 flex-col items-start">
        <span className="w-full truncate text-h3 text-ods-text-primary">{title}</span>
        <span className="w-full truncate text-h6 text-ods-text-secondary">{caption}</span>
      </span>

      <span className="flex shrink-0 items-center justify-center rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-sf)] text-ods-text-primary">
        <Chevron02RightIcon className="size-6" />
      </span>
    </Link>
  )
}

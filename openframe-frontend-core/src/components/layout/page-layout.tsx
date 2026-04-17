'use client'

import { ChevronLeft } from 'lucide-react'
import React from 'react'
import { cn } from '../../utils/cn'
import { Button } from '../ui/button'
import type { MoreActionsItem } from '../ui/more-actions-menu'
import { PageActions, type PageActionButton } from '../ui/page-actions'

const PADDING = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' } as const
const BACKGROUND = { default: 'bg-ods-bg', card: 'bg-ods-card', transparent: '' } as const

export interface PageLayoutProps {
  children: React.ReactNode
  title?: string
  backButton?: { label?: string; onClick: () => void }
  /** @deprecated Use `actions` instead for consistent action handling */
  headerActions?: React.ReactNode
  actions?: PageActionButton[]
  actionsVariant?: 'icon-buttons' | 'primary-buttons' | 'menu-primary'
  menuActions?: MoreActionsItem[]
  padding?: keyof typeof PADDING
  background?: keyof typeof BACKGROUND
  className?: string
  contentClassName?: string
  showHeader?: boolean
}

/**
 * Page layout container with consistent spacing, header, and actions.
 *
 * Uses `--spacing-system-l` as the gap between sections.
 */
export function PageLayout({
  children,
  title,
  backButton,
  headerActions,
  actions,
  actionsVariant = 'icon-buttons',
  menuActions,
  padding = 'none',
  background = 'transparent',
  className,
  contentClassName,
  showHeader = true,
}: PageLayoutProps) {
  const hasActions = actions && actions.length > 0
  const needsBottomPadding = hasActions && actionsVariant === 'primary-buttons'
  const hasHeader = showHeader && (title || backButton || headerActions || hasActions)

  return (
    <div
      className={cn('flex flex-col w-full', BACKGROUND[background], PADDING[padding], className)}
    >
      {hasHeader && (
        <div className="flex items-end justify-between md:flex-col md:items-start md:justify-start lg:flex-row lg:items-end lg:justify-between gap-[var(--spacing-system-m)] mb-[var(--spacing-system-l)]">
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            {backButton && (
              <Button
                onClick={backButton.onClick}
                variant="ghost-subtle"
                className="self-start justify-start hidden md:flex"
                leftIcon={<ChevronLeft className="size-6" />}
                noPadding
              >
                {backButton.label || 'Back'}
              </Button>
            )}
            {title && (
              <h1 className="text-h2 text-ods-text-primary">{title}</h1>
            )}
          </div>

          {(headerActions || hasActions) && (
            <div className="flex gap-2 items-center shrink-0">
              {headerActions}
              {hasActions && (
                <PageActions variant={actionsVariant} actions={actions} menuActions={menuActions} />
              )}
            </div>
          )}
        </div>
      )}

      <div className={cn('flex flex-col flex-1 gap-[var(--spacing-system-l)]', needsBottomPadding && 'pb-28 md:pb-0', contentClassName)}>
        {children}
      </div>
    </div>
  )
}

export type { PageActionButton } from '../ui/page-actions'
export default PageLayout

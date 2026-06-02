'use client'

import React from 'react'
import { cn } from '../../utils/cn'
import type { ActionsMenuGroup } from '../ui/actions-menu'
import { EntityImage } from '../ui/entity-image'
import { PageActions, type PageActionButton } from '../ui/page-actions'
import { BackButton } from './back-button'

export interface TitleBlockProps {
  title?: string
  subtitle?: string
  image?: { src: string; alt?: string }
  backButton?: { label?: string; onClick: () => void }
  actions?: PageActionButton[]
  actionsVariant?: 'icon-buttons' | 'primary-buttons' | 'menu-primary'
  menuActions?: ActionsMenuGroup[]
  /** Desktop-only slot (e.g. a `TabSelector`) rendered with the actions. Hidden on mobile. */
  selector?: React.ReactNode
  /**
   * Visual variant.
   * - `plain` (default): transparent background, no border.
   * - `card`: card background, border, and padding on mobile only — collapses to plain on md+.
   */
  variant?: 'plain' | 'card'
  className?: string
}

export function TitleBlock({
  title,
  subtitle,
  image,
  backButton,
  actions,
  actionsVariant = 'icon-buttons',
  menuActions,
  selector,
  variant = 'plain',
  className,
}: TitleBlockProps) {
  const hasActions = actions && actions.length > 0
  const hasMenuActions = !!menuActions && menuActions.some(g => g.items.length > 0)

  return (
    <div
      className={cn(
        'flex items-end justify-between gap-[var(--spacing-system-m)]',
        'md:flex-col md:items-start md:justify-start lg:flex-row lg:items-end lg:justify-between',
        'pt-[var(--spacing-system-l)]',
        variant === 'card'
          ? cn(
              'bg-ods-card border-b border-ods-border',
              'px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]',
              'md:bg-transparent md:border-b-0',
              'md:px-0 md:pb-0',
              'md:mb-[var(--spacing-system-l)]',
            )
          : 'mb-[var(--spacing-system-l)]',
        className,
      )}
    >
      <div className="flex flex-col gap-[var(--spacing-system-xs)] flex-1 min-w-0">
        {backButton && (
          <BackButton
            onClick={backButton.onClick}
            label={backButton.label}
            className="hidden md:inline-flex"
          />
        )}
        {(image || subtitle) ? (
          <div className="flex items-center gap-[var(--spacing-system-m)] min-w-0 w-full">
            {image && (
              <EntityImage
                src={image.src}
                alt={image.alt}
                fallbackText={image.alt || title}
              />
            )}
            <div className="flex flex-col justify-center min-w-0 flex-1">
              {title && (
                <h1 className="text-h2 text-ods-text-primary truncate" title={title}>{title}</h1>
              )}
              {subtitle && (
                <p className="text-h6 text-ods-text-secondary truncate" title={subtitle}>{subtitle}</p>
              )}
            </div>
          </div>
        ) : (
          title && <h1 className="text-h2 text-ods-text-primary">{title}</h1>
        )}
      </div>

      {(hasActions || hasMenuActions || selector) && (
        <div className="flex gap-2 items-center shrink-0">
          <PageActions
            variant={actionsVariant}
            actions={actions ?? []}
            menuActions={menuActions}
            selector={selector}
          />
        </div>
      )}
    </div>
  )
}

export default TitleBlock

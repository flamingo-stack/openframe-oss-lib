'use client'

import React from 'react'
import { cn } from '../../utils/cn'
import type { ActionsMenuGroup } from '../ui/actions-menu'
import { type PageActionButton } from '../ui/page-actions'
import { TitleBlock } from './title-block'

export interface PageLayoutProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  image?: { src: string; alt?: string }
  backButton?: { label?: string; onClick: () => void }
  actions?: PageActionButton[]
  actionsVariant?: 'icon-buttons' | 'primary-buttons' | 'menu-primary'
  menuActions?: ActionsMenuGroup[]
  /** Desktop-only slot (e.g. a `TabSelector`) rendered with the actions. Hidden on mobile. */
  selector?: React.ReactNode
  /** Header visual variant. `card` adds a card background, border, and padding on mobile. */
  headerVariant?: 'plain' | 'card'
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
  subtitle,
  image,
  backButton,
  actions,
  actionsVariant = 'icon-buttons',
  menuActions,
  selector,
  headerVariant,
  className,
  contentClassName,
  showHeader = true,
}: PageLayoutProps) {
  const hasActions = actions && actions.length > 0
  const needsBottomPadding = hasActions && actionsVariant === 'primary-buttons'
  const hasHeader = showHeader && (title || subtitle || image || backButton || hasActions || selector)

  return (
    <div className={cn('flex flex-col w-full', className)}>
      {hasHeader && (
        <TitleBlock
          title={title}
          subtitle={subtitle}
          image={image}
          backButton={backButton}
          actions={actions}
          actionsVariant={actionsVariant}
          menuActions={menuActions}
          selector={selector}
          variant={headerVariant}
        />
      )}

      <div className={cn('flex flex-col flex-1 gap-[var(--spacing-system-l)]', needsBottomPadding && 'pb-28 md:pb-0', contentClassName)}>
        {children}
      </div>
    </div>
  )
}

export type { PageActionButton } from '../ui/page-actions'
export { TitleBlock } from './title-block'
export type { TitleBlockProps } from './title-block'
export default PageLayout

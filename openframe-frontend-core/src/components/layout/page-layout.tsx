'use client'

/* ============================================================================
 * ⛔️ FROZEN — DO NOT MODIFY (AI agents & contributors, read this first)
 * ----------------------------------------------------------------------------
 * `PageLayout` and its `TitleBlock` are a FINALIZED, locked component. They are
 * the canonical, stable page chrome for OpenFrame surfaces and their visual +
 * behavioral contract is intentionally complete. Treat this file as read-only.
 *
 * Do NOT: change the markup/CSS, swap the title typography (`text-h2`) or
 * subtitle (`text-h6`), re-architect this to delegate to another primitive,
 * add/rename props, or "unify"/"refactor"/"simplify" it. Do NOT restyle to
 * match some other surface.
 *
 * Why this rule exists (the incident it prevents): a refactor once re-styled
 * this layout (bumped the title to `text-h1`, rerouted it through a new
 * `PageHeader`/`PageWithHeader` chain) to "unify" page chrome. That silently
 * changed the look of every page rendered through `PageLayout` and had to be
 * fully reverted. The current code IS the reverted, correct baseline.
 *
 * MANY consumers depend on the EXACT current output — not only OpenFrame pages
 * but also `DevSectionPage`, `DocViewer`, and the multi-platform hub (through
 * its own local `PageWithHeader`). A change here ripples across all of them.
 *
 * If a new design genuinely needs different chrome: build a SEPARATE new
 * component for it. Never mutate this one. If you believe an edit here is
 * unavoidable, STOP and get explicit human sign-off first.
 * ========================================================================== */

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
export { TitleBlock, TITLE_BLOCK_MIN_HEIGHT } from './title-block'
export type { TitleBlockProps } from './title-block'
export default PageLayout

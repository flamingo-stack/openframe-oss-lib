'use client'

import React from 'react'
import type { ActionsMenuGroup } from '../ui/actions-menu'
import { PageActions, type PageActionButton } from '../ui/page-actions'
import { PageHeader } from './page-header'

/**
 * `<TitleBlock>` — thin adapter over `<PageHeader>` that turns the
 * `actions: PageActionButton[]` / `menuActions` / `selector` API into
 * a `ReactNode` slot that PageHeader can render. Kept as a separate
 * component for backwards compatibility (`PageLayout` consumes it,
 * external callers may too) — all the DOM/CSS lives in PageHeader.
 *
 * If a new consumer doesn't need the `PageActions` wiring, prefer
 * `<PageHeader>` directly.
 */
export interface TitleBlockProps {
  title?: string
  subtitle?: string
  /** Inline icon rendered before the title text (e.g. HelpCircle on /faqs,
   *  BookOpen on /knowledge-base, Map on /roadmap). Forwarded verbatim to
   *  `<PageHeader>`. */
  titleIcon?: React.ReactNode
  /** Yellow accent dot after the title — same flag as PageHeader. */
  accentDot?: boolean
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
  titleIcon,
  accentDot,
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
  const hasActionsSlot = hasActions || hasMenuActions || !!selector

  const actionsNode = hasActionsSlot ? (
    <PageActions
      variant={actionsVariant}
      actions={actions ?? []}
      menuActions={menuActions}
      selector={selector}
    />
  ) : undefined

  return (
    <PageHeader
      title={title}
      titleIcon={titleIcon}
      subtitle={subtitle}
      accentDot={accentDot}
      image={image}
      backButton={backButton}
      actions={actionsNode}
      variant={variant}
      className={className}
    />
  )
}

export default TitleBlock

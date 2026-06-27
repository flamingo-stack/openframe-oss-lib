'use client'

/* ============================================================================
 * ⛔️ FROZEN — DO NOT MODIFY (AI agents & contributors, read this first)
 * ----------------------------------------------------------------------------
 * `TitleBlock` is the FINALIZED title/subtitle/back-button/actions chrome used
 * by `PageLayout`. It is a locked, complete component — treat it as read-only.
 *
 * Do NOT: change the markup/CSS, alter the title typography (`text-h2`) or
 * subtitle (`text-h6`), change the image/title 2-column layout, re-route this
 * through a `PageHeader`/`PageWithHeader` primitive, or add/rename props. Do
 * NOT "unify"/"refactor"/"simplify" it or restyle it to match another surface.
 *
 * Why this rule exists (the incident it prevents): a refactor once rewrote
 * this to delegate to a new `PageHeader` (title bumped to `text-h1`, new
 * subtitle styling) to "unify" page chrome — it silently changed every page
 * using `PageLayout` and had to be fully reverted. This code IS that reverted,
 * correct baseline.
 *
 * Downstream consumers (OpenFrame pages, `DevSectionPage`, `DocViewer`, and the
 * multi-platform hub via its local `PageWithHeader`) depend on the EXACT
 * current output. If a new design needs different chrome, build a SEPARATE new
 * component — never mutate this one. If an edit here seems unavoidable, STOP
 * and get explicit human sign-off first.
 *
 * SANCTIONED EXCEPTION (2026-06, explicit human sign-off): the OPTIONAL
 * `titleSize` prop. It defaults to `'h2'` — i.e. the frozen baseline above is
 * unchanged for EVERY existing caller. A caller may pass `titleSize="h1"` to
 * opt the title typography up to `text-h1` (used by the unified Help Center
 * pages). This is additive and default-preserving; do NOT change the default or
 * touch anything else here.
 * ========================================================================== */

import React from 'react'
import { cn } from '../../utils/cn'
import type { ActionsMenuGroup } from '../ui/actions-menu'
import { EntityImage } from '../ui/entity-image'
import { PageActions, type PageActionButton } from '../ui/page-actions'
import { BackButton } from './back-button'

/**
 * Minimum height of the title block's content column, matched to the action
 * button height: the icon button on mobile (`h-11` → 44px) and the default
 * button on desktop (`md:h-12` → 48px). Applied to the inner title column (which
 * has no padding) rather than the root — the root's `pt`/`mb` are box-sizing
 * border-box and would otherwise absorb the floor. Keeps the header a consistent
 * height across pages whether or not they render action buttons, so the content
 * below starts at the same baseline. Exported so other page chrome can reuse it.
 */
export const TITLE_BLOCK_MIN_HEIGHT = 'min-h-11 md:min-h-12'

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
  /** Title typography size. Default `'h2'` (the frozen baseline). Pass `'h1'` to
   *  opt the title up to `text-h1` (the unified Help Center pages). Subtitle stays
   *  `text-h6` either way. */
  titleSize?: 'h1' | 'h2'
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
  titleSize = 'h2',
}: TitleBlockProps) {
  const hasActions = actions && actions.length > 0
  const hasMenuActions = !!menuActions && menuActions.some(g => g.items.length > 0)
  const titleClass = titleSize === 'h1' ? 'text-h1' : 'text-h2'

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
      <div className={cn('flex flex-col justify-center gap-[var(--spacing-system-xs)] flex-1 min-w-0', TITLE_BLOCK_MIN_HEIGHT)}>
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
                <h1 className={cn(titleClass, 'text-ods-text-primary truncate')} title={title}>{title}</h1>
              )}
              {subtitle && (
                <p className="text-h6 text-ods-text-secondary truncate" title={subtitle}>{subtitle}</p>
              )}
            </div>
          </div>
        ) : (
          title && <h1 className={cn(titleClass, 'text-ods-text-primary')}>{title}</h1>
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

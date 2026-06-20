'use client'

import React from 'react'
import { cn } from '../../utils/cn'
import { EntityImage } from '../ui/entity-image'
import { BackButton } from './back-button'

/**
 * Page-header primitive — the canonical "back-button + title + subtitle
 * + (optional) image / actions" chrome every lib page uses.
 *
 * Owns the SSOT for the page-header DOM/CSS that the rest of the lib
 * was duplicating: pre-`mb` top padding, h1 typography (`text-h2`), h6
 * subtitle (`text-h6`), the gap between the back button and the title
 * block, and the right-side actions slot. Consumers either render this
 * directly (e.g. `<DocViewer>` / `<DocsHubPage>`) or compose it through
 * the `<TitleBlock>` adapter which adds the `PageActions` /
 * `ActionsMenu` / selector wiring on top.
 *
 * Why this exists: knowledge-hub vs releases sat at different vertical
 * rhythms (px-perfect mismatch on title baseline + subtitle offset)
 * because the docs surface hand-rolled its own chrome instead of going
 * through `TitleBlock`. Centralizing the layout here means every
 * embeddable lib page (DocViewer, DevSectionPage, LegalDocumentPage,
 * OnboardingGuideDetailView) renders pixel-identical title/subtitle/
 * back-button typography + spacing — and a future spacing/typography
 * tweak is one file.
 */
export interface PageHeaderProps {
  /** Page title (h1). Plain string — ReactNode is intentionally not
   *  supported here so every consumer renders the same typography. */
  title?: string
  /** Page subtitle (h6, secondary text). */
  subtitle?: string
  /**
   * Render a yellow accent dot (`.`) after the title. Mirrors the
   * hub's legacy `<AdminPageHeader accentDot>` flag — now lib-wide so
   * surfaces like `/knowledge-base` keep their existing accent styling
   * after the migration.
   */
  accentDot?: boolean
  /** Optional thumbnail / hero image rendered to the left of the
   *  title block. Used by entity-image-style headers (onboarding
   *  guides, knowledge-base entries). */
  image?: { src: string; alt?: string }
  /** Back-button shown above the title block. Hidden on mobile (matches
   *  the existing TitleBlock + DocViewer behavior). */
  backButton?: { label?: string; onClick: () => void }
  /** Right-side actions slot (action buttons / menu / tab selector).
   *  Composed externally (e.g. `<TitleBlock>` builds `PageActions` + menu
   *  + selector and passes the result here). */
  actions?: React.ReactNode
  /**
   * Visual variant.
   * - `plain` (default): transparent background, no border.
   * - `card`: card background, border, and padding on mobile only —
   *   collapses to plain on md+ (legacy `TitleBlock` variant — kept so
   *   surfaces that depend on the card affordance don't regress).
   */
  variant?: 'plain' | 'card'
  className?: string
}

export function PageHeader({
  title,
  subtitle,
  accentDot,
  image,
  backButton,
  actions,
  variant = 'plain',
  className,
}: PageHeaderProps) {
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
                <h1
                  className="text-h2 text-ods-text-primary truncate"
                  title={title}
                >
                  {title}
                  {accentDot && <span className="text-ods-accent">.</span>}
                </h1>
              )}
              {subtitle && (
                <p
                  className="text-h6 text-ods-text-secondary truncate"
                  title={subtitle}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        ) : (
          title && (
            <h1 className="text-h2 text-ods-text-primary">
              {title}
              {accentDot && <span className="text-ods-accent">.</span>}
            </h1>
          )
        )}
      </div>

      {actions && (
        <div className="flex gap-2 items-center shrink-0">{actions}</div>
      )}
    </div>
  )
}

export default PageHeader

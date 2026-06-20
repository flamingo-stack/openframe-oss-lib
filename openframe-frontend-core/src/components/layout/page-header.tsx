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
  /** Optional icon rendered inline before the title text (e.g. the
   *  rocket emoji on /releases, the docs icon on /knowledge-base).
   *  Same `flex items-center gap-3` row as `<DevSectionView>`'s hero. */
  titleIcon?: React.ReactNode
  /** Page subtitle (description paragraph). */
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
  /** When the consumer wraps `<PageHeader>` in its OWN spacing container
   *  (e.g. `<DevSectionView>`'s `gap-10 flex-col`), the default `mb-l`
   *  bottom margin doubles up. Pass `noBottomMargin` to opt out. */
  noBottomMargin?: boolean
  /** Same as `noBottomMargin` for the default `pt-l` top padding. Set
   *  this when PageHeader is nested INSIDE another layout that already
   *  provides top spacing (e.g. `<DevSectionView>`'s hero, which sits
   *  inside `<PageLayout>`'s children flow). */
  noTopPadding?: boolean
  className?: string
}

// Title typography — copied verbatim from <DevSectionView>'s hero h1
// (`src/components/shared/dev-section/dev-section-view.tsx`). The user-
// reported "header text not aligned" between /knowledge-base and
// /releases bottomed out here: DevSectionView rendered text-h1 with
// tracking-[-1.12px] while this component used text-h2 — visually huge
// gap. Now both render through the exact same class string. DevSectionView
// is being refactored in this commit to delegate to <PageHeader> so the
// shared-component claim is enforced at the code level too.
const TITLE_CLASS = 'text-h1 tracking-[-1.12px] text-ods-text-primary flex items-center gap-3'
// Subtitle ALWAYS occupies exactly 2 lines of vertical space.
//   `min-h-[56px]` (= 2 × 28px leading) reserves the row height so a
//   single-line subtitle doesn't shrink the header — page-to-page height
//   stays consistent.
//   `line-clamp-2` caps long copy at 2 lines + ellipsis so wrapping doesn't
//   push the search bar down.
const SUBTITLE_CLASS = "font-['DM_Sans'] font-medium text-[18px] leading-[28px] text-ods-text-secondary max-w-3xl line-clamp-2 min-h-[56px]"

export function PageHeader({
  title,
  titleIcon,
  subtitle,
  accentDot,
  image,
  backButton,
  actions,
  variant = 'plain',
  noBottomMargin = false,
  noTopPadding = false,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-end justify-between gap-[var(--spacing-system-m)]',
        'md:flex-col md:items-start md:justify-start lg:flex-row lg:items-end lg:justify-between',
        !noTopPadding && 'pt-[var(--spacing-system-l)]',
        variant === 'card'
          ? cn(
              'bg-ods-card border-b border-ods-border',
              'px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]',
              'md:bg-transparent md:border-b-0',
              'md:px-0 md:pb-0',
              !noBottomMargin && 'md:mb-[var(--spacing-system-l)]',
            )
          : !noBottomMargin && 'mb-[var(--spacing-system-l)]',
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
        {/* Title + subtitle stack. Matches `<DevSectionView>`'s hero
         *  exactly: `space-y-4` between h1 and p, `flex items-center
         *  gap-3` for icon-inline title row, identical class strings.
         *  Image (entity-image-style) prefixes the title row, NOT a
         *  separate column with its own vertical rhythm — that's the
         *  legacy TitleBlock 2-col layout which broke the title-to-
         *  subtitle gap. */}
        {(title || subtitle || image || titleIcon) && (
          <div className="space-y-4">
            {(title || image || titleIcon) && (
              <h1 className={TITLE_CLASS}>
                {image && (
                  <EntityImage
                    src={image.src}
                    alt={image.alt}
                    fallbackText={image.alt || title}
                  />
                )}
                {titleIcon}
                {title && (
                  <span>
                    {title}
                    {accentDot && <span className="text-ods-accent">.</span>}
                  </span>
                )}
              </h1>
            )}
            {subtitle && <p className={SUBTITLE_CLASS}>{subtitle}</p>}
          </div>
        )}
      </div>

      {actions && (
        <div className="flex gap-2 items-center shrink-0">{actions}</div>
      )}
    </div>
  )
}

export default PageHeader

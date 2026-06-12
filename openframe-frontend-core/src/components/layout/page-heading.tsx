import type { ReactNode } from 'react'

/**
 * THE page-title style — the ODS `text-h1` token (`--font-size-h1-title` =
 * 40 / 48 / 56px, Azeret Mono semibold), which already owns the responsive
 * letter-spacing (-0.02em). Mirrors the global `h1 { @apply text-h1 }` base, so
 * every page heading is the SAME size across the lib and every consuming app.
 *
 * Single source of truth — do NOT hardcode a px size or re-assert the token's
 * tracking; render `<PageHeading>` (or, for the rare non-h1 caller, apply
 * `PAGE_HEADING_CLASS`).
 */
export const PAGE_HEADING_CLASS = 'text-h1 text-ods-text-primary'

/**
 * THE section-heading style — the ODS `text-h2` sub-title token
 * (`--font-size-h2-sub-title` = 24 / 32 / 32px), one step below the page
 * title so a section `<h2>`/`<h3>` is always visually distinguishable from
 * the page's `<h1>`. Same single-source rule as PAGE_HEADING_CLASS: never
 * hardcode a px ramp or re-assert the token's tracking on a section heading.
 */
export const SECTION_HEADING_CLASS = 'text-h2 text-ods-text-primary'

const DESCRIPTION_CLASS =
  "mt-6 max-w-[640px] font-['DM_Sans'] text-[16px] md:text-[18px] leading-[24px] md:leading-[28px] text-ods-text-secondary"

export interface PageHeadingProps {
  /** Heading content — plain text or nodes (e.g. an accent <span>). */
  children: ReactNode
  /**
   * Heading level. Defaults to 'h1' (exactly one per page). Pass 'h2' where the
   * page already renders an <h1> above (e.g. a hero/featured item).
   */
  as?: 'h1' | 'h2'
  /** Optional supporting copy rendered as a <p> beneath the heading. */
  description?: ReactNode
  /** Extra classes merged onto the heading (margins, width, truncate, etc.). */
  className?: string
  /** Extra classes merged onto the description <p>. */
  descriptionClassName?: string
}

/**
 * Unified page heading. Renders the canonical page-title <h1> (or <h2>) plus an
 * optional description, so every page shares one consistent style instead of
 * duplicating the class string. Layout (PageContainer, margins, surrounding
 * sections) stays with the caller — this owns only the heading + description.
 */
export function PageHeading({
  children,
  as: Tag = 'h1',
  description,
  className,
  descriptionClassName,
}: PageHeadingProps) {
  const headingClass = className ? `${PAGE_HEADING_CLASS} ${className}` : PAGE_HEADING_CLASS
  const descClass = descriptionClassName ? `${DESCRIPTION_CLASS} ${descriptionClassName}` : DESCRIPTION_CLASS
  // `description` is a ReactNode, so `description={cond && '...'}` can pass a
  // boolean `false` — exclude it (and empty string) so we never render an empty
  // <p> that adds phantom vertical gap beneath the heading.
  const hasDescription =
    description != null && description !== '' && typeof description !== 'boolean'
  return (
    <>
      <Tag className={headingClass}>{children}</Tag>
      {hasDescription && <p className={descClass}>{description}</p>}
    </>
  )
}

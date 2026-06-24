'use client'

/**
 * `<OnboardingGuidesCatalogPage>` — the full `/onboarding-guides` catalog page:
 * `DevSectionPage sectionKey="onboarding"` chrome wrapping the self-contained
 * `<OnboardingGuidesCatalogView>` (RAG search + section pills + guide grid).
 * Supports both SSR (`initialGuides`/`initialSections`) and self-fetch
 * (`guidesEndpoint`/`sectionsEndpoint`) modes — forwarded to the view verbatim.
 */

import type { ReactNode } from 'react'
import type { OnboardingGuide } from '../chat/types/entities/onboarding-guide'
import { DevSectionPage } from '../shared/dev-section'
import { OnboardingGuidesCatalogView } from '../onboarding-guides'

type SectionSummary = { section: string; section_order: number; count: number }

export interface OnboardingGuidesCatalogPageProps {
  /** Self-fetch: GET list endpoint (the api route). Appends `?section=`. */
  guidesEndpoint?: string
  /** Self-fetch: GET section-summary endpoint (the api route). */
  sectionsEndpoint?: string
  /** Controlled / SSR: server-fetched guides + sections + active section. */
  initialGuides?: OnboardingGuide[]
  initialSections?: SectionSummary[]
  initialSection?: string
  /** Base path the catalog is mounted under (card href prefix + `?section=` push). */
  basePath?: string
  /** Back-button config. Pass `false` to hide. Default `{ href: '/' }`. */
  backButton?: { label?: string; href?: string } | false
  title?: string
  subtitle?: string
  /** Optional slot rendered below the catalog, inside the page chrome. */
  belowContent?: ReactNode
  /** Render the standalone `<PageShell>`. Default true. Pass false when the host
   *  layout already provides the page container (forwarded to `DevSectionPage`). */
  shell?: boolean
}

export function OnboardingGuidesCatalogPage({
  guidesEndpoint,
  sectionsEndpoint,
  initialGuides,
  initialSections,
  initialSection,
  basePath,
  backButton,
  title,
  subtitle,
  belowContent,
  shell,
}: OnboardingGuidesCatalogPageProps) {
  return (
    <DevSectionPage sectionKey="onboarding" backButton={backButton} title={title} subtitle={subtitle} shell={shell}>
      <OnboardingGuidesCatalogView
        guidesEndpoint={guidesEndpoint}
        sectionsEndpoint={sectionsEndpoint}
        initialGuides={initialGuides}
        initialSections={initialSections}
        initialSection={initialSection}
        basePath={basePath}
      />
      {belowContent}
    </DevSectionPage>
  )
}

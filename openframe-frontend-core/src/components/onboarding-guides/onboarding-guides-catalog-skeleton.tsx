'use client'

import { DevSectionPage } from '../shared/dev-section'
import { OnboardingGuideCardSkeleton } from '../chat/entity-cards/onboarding-guide-card'

/**
 * Page-level Suspense fallback for `/onboarding-guides`.
 *
 * Mirrors the loaded `<OnboardingGuidesCatalogView>` shape — both
 * mount the same `<DevSectionPage sectionKey="onboarding">` so the
 * hero, back button, and overall page scaffold render identically.
 *
 * The `preControls` slot reserves space for the search bar (h-12)
 * plus the section pill row (~74px including padding) so the
 * Suspense → loaded transition doesn't shift vertically.
 *
 * Card distribution `4 + 3 + 3 = 10` matches the typical openframe
 * onboarding dataset; per-card height (288 px) is byte-identical to
 * the loaded card so per-card shifts on resolve are zero.
 */
export function OnboardingGuidesCatalogSkeleton() {
  return (
    <DevSectionPage
      sectionKey="onboarding"
      preControls={
        <div className="space-y-4 animate-pulse">
          {/* Search input placeholder — matches `<SearchInput>` h-12. */}
          <div className="h-12 w-full bg-ods-card border border-ods-border rounded-md" />
          {/* Section pill row placeholder — same wrapper class set the
              hub-side `<FilterSection>` uses (~74 px). */}
          <div className="flex flex-wrap items-center gap-3 p-4 bg-ods-card border border-ods-border rounded-lg">
            <div className="h-4 w-14 bg-ods-border/60 rounded" />
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-10 w-24 bg-ods-card border border-ods-border rounded-md"
              />
            ))}
          </div>
        </div>
      }
    >
      <div className="space-y-10 animate-pulse">
        {[4, 3, 3].map((cardCount, sectionIdx) => (
          <section key={sectionIdx} className="space-y-4">
            <h2 className="text-h3 tracking-[-0.36px] text-ods-text-primary flex items-center gap-2">
              <span className="h-6 w-40 bg-ods-border/70 rounded" />
              <span className="h-5 w-8 bg-ods-text-secondary/20 rounded-full" />
            </h2>
            <ul className="flex flex-col gap-4">
              {Array.from({ length: cardCount }).map((_, cardIdx) => (
                <li key={cardIdx}>
                  <OnboardingGuideCardSkeleton size="catalog" />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </DevSectionPage>
  )
}

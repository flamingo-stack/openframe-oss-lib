'use client'

import { OnboardingGuideCardSkeleton } from '../chat/entity-cards/onboarding-guide-card'

/**
 * Loading skeleton for `/onboarding-guides` — CHROME-LESS, exactly like the
 * loaded `<OnboardingGuidesCatalogView>`. The HOST page owns the
 * `<DevSectionPage sectionKey="onboarding">` shell (hero + back button);
 * this component renders only what replaces the view: the search/pill
 * placeholder block and the section card lists.
 *
 * HISTORY: this used to mount its own `<DevSectionPage>` — nested inside the
 * page's shell that double-rendered the hero + back button during loading
 * (the view was made chrome-less in the page restructure; the skeleton was
 * missed). Keep BOTH chrome-less.
 *
 * Wrapper mirrors the loaded view's `w-full flex flex-col gap-10`; per-card
 * height matches the loaded catalog card so resolve shifts are zero.
 */
export function OnboardingGuidesCatalogSkeleton() {
  return (
    <div className="w-full flex flex-col gap-10 animate-pulse">
      {/* Search input placeholder — matches `<SearchInput>` h-12 — plus the
          section pill row (~74 px incl. padding), same as the loaded
          preControls block. */}
      <div className="space-y-4">
        <div className="h-12 w-full bg-ods-card border border-ods-border rounded-md" />
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
      <div className="space-y-10">
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
    </div>
  )
}

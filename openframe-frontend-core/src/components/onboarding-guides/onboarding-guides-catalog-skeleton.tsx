'use client';

import { OnboardingGuideCardSkeleton } from '../chat/entity-cards/onboarding-guide-card';

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
    <div className="flex w-full animate-pulse flex-col gap-10">
      {/* Search input placeholder — matches `<SearchInput>` h-12 — plus the
          section pill row (~74 px incl. padding), same as the loaded
          preControls block. */}
      <div className="space-y-4">
        <div className="h-12 w-full rounded-md border border-ods-border bg-ods-card" />
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-ods-border bg-ods-card p-4">
          <div className="h-4 w-14 rounded bg-ods-border/60" />
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-10 w-24 rounded-md border border-ods-border bg-ods-card" />
          ))}
        </div>
      </div>
      <div className="space-y-10">
        {[4, 3, 3].map((cardCount, sectionIdx) => (
          <section key={sectionIdx} className="space-y-4">
            <h2 className="flex items-center gap-2 tracking-[-0.36px] text-ods-text-primary text-h3">
              <span className="h-6 w-40 rounded bg-ods-border/70" />
              <span className="h-5 w-8 rounded-full bg-ods-text-secondary/20" />
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
  );
}

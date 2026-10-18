'use client';

import { OnboardingGuideCardSkeleton } from '../chat/entity-cards/onboarding-guide-card';
import { LoadingRegion } from '../loading/loading-region';
import { InteractiveSkeleton, TextLineSkeleton } from '../loading/unified-skeleton';
import { FilterPillRowSkeleton } from '../ui/filter-pill-row';

/** The catalog's layout, read by the loaded view and by this skeleton, so the skeleton is the view's size. */
export const CATALOG_VIEW_CLASS = 'flex w-full flex-col gap-10';
export const CATALOG_CONTROLS_CLASS = 'space-y-4';
export const CATALOG_SECTIONS_CLASS = 'space-y-10';
export const CATALOG_SECTION_CLASS = 'space-y-4';
export const CATALOG_SECTION_HEADING_CLASS = 'flex items-center gap-2 text-ods-text-primary text-h3';
export const CATALOG_SECTION_COUNT_CLASS =
  'inline-flex items-center justify-center rounded-full bg-ods-text-secondary/20 px-2 py-0.5 text-ods-text-secondary text-h6';
export const CATALOG_LIST_CLASS = 'flex flex-col gap-4';

/**
 * Catalog cards one screen shows under the search and the section pills (a 1440x900 desktop and a 390x844 phone
 * both fit three of the `catalog` card's height before the fold). The section count is the data's: the skeleton
 * draws ONE section of this fold, and every loaded section is a `data-loading-item`.
 */
export const ONBOARDING_CATALOG_CARD_FOLD = 3;
/** Section pills one row shows before it wraps (the "All" pill and the first sections). */
const ONBOARDING_CATALOG_PILL_FOLD = 4;

/**
 * Loading skeleton for `/onboarding-guides`: CHROME-LESS, exactly like the loaded `<OnboardingGuidesCatalogView>`.
 * The HOST page owns the shell (hero + back button); this renders only what replaces the view: the search input,
 * the section pill row (its label real) and one section of `ONBOARDING_CATALOG_CARD_FOLD` cards, in the view's own
 * classes.
 */
export function OnboardingGuidesCatalogSkeleton({
  region = true,
}: {
  /** The loading state announces itself (`LoadingRegion`). `false` inside another loading region. Default `true`. */
  region?: boolean;
} = {}) {
  return (
    <LoadingRegion label="Loading onboarding guides" announce={region} className={CATALOG_VIEW_CLASS}>
      <div className={CATALOG_CONTROLS_CLASS}>
        <InteractiveSkeleton.Input />
        <FilterPillRowSkeleton label="Section" pills={ONBOARDING_CATALOG_PILL_FOLD} />
      </div>
      <div className={CATALOG_SECTIONS_CLASS}>
        <section className={CATALOG_SECTION_CLASS} data-loading-item>
          <h2 className={CATALOG_SECTION_HEADING_CLASS}>
            <TextLineSkeleton type="inherit" as="span" className="w-40" />
            <span className={CATALOG_SECTION_COUNT_CLASS}>
              <TextLineSkeleton type="inherit" as="span" className="w-3" />
            </span>
          </h2>
          <ul className={CATALOG_LIST_CLASS}>
            {Array.from({ length: ONBOARDING_CATALOG_CARD_FOLD }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton cards never reorder
              <li key={i}>
                <OnboardingGuideCardSkeleton size="catalog" />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </LoadingRegion>
  );
}

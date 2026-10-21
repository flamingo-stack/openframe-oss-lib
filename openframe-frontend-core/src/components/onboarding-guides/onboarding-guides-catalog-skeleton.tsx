'use client';

import { OnboardingGuideCardSkeleton } from '../chat/entity-cards/onboarding-guide-card';
import { TextLineSkeleton } from '../loading/unified-skeleton';

/** The catalog's layout, read by the loaded view and by its sections' skeleton, so the skeleton is the view's size. */
export const CATALOG_VIEW_CLASS = 'flex w-full flex-col gap-10';
export const CATALOG_CONTROLS_CLASS = 'space-y-4';
export const CATALOG_SECTIONS_CLASS = 'space-y-10';
export const CATALOG_SECTION_CLASS = 'space-y-4';
export const CATALOG_SECTION_HEADING_CLASS = 'flex items-center gap-2 text-ods-text-primary text-h3';
export const CATALOG_SECTION_COUNT_CLASS =
  'inline-flex items-center justify-center rounded-full bg-ods-text-secondary/20 px-2 py-0.5 text-ods-text-secondary text-h6';
export const CATALOG_LIST_CLASS = 'flex flex-col gap-4';

/**
 * Catalog cards the skeleton's section draws: a typical count, at every width. The catalog reads every guide (no
 * page, no limit), so there is no page size to draw. The section count is the data's too: the skeleton draws ONE
 * section, and every loaded section is a `data-loading-item`.
 */
export const ONBOARDING_CATALOG_SKELETON_CARDS = 3;
/**
 * The catalog's sections while the guides are read: ONE section of `ONBOARDING_CATALOG_SKELETON_CARDS` cards in the view's
 * own classes (its heading and count bars). The view draws it itself (`useLoadingScope() || loading`): its search bar
 * is real and its section pills draw their own skeleton.
 */
export function OnboardingCatalogSectionsSkeleton() {
  return (
    <div className={CATALOG_SECTIONS_CLASS}>
      <section className={CATALOG_SECTION_CLASS} data-loading-item>
        <h2 className={CATALOG_SECTION_HEADING_CLASS}>
          <TextLineSkeleton type="inherit" as="span" className="w-40" />
          <span className={CATALOG_SECTION_COUNT_CLASS}>
            <TextLineSkeleton type="inherit" as="span" className="w-3" />
          </span>
        </h2>
        <ul className={CATALOG_LIST_CLASS}>
          {Array.from({ length: ONBOARDING_CATALOG_SKELETON_CARDS }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton cards never reorder
            <li key={i}>
              <OnboardingGuideCardSkeleton size="catalog" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

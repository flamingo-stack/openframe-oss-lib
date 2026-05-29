/**
 * Onboarding Guides surface barrel.
 *
 * Mirrors `components/tickets/` — top-level openframe-route-specific
 * product surface (NOT under `shared/`, which is reserved for
 * cross-platform marketing).
 *
 * IMPORTANT: this barrel MUST NOT re-export `OnboardingGuide`,
 * `OnboardingGuideFilters`, `OnboardingGuideListResponse`, or
 * `OnboardingGuideSectionSummary`. Those types already flow via
 * `components/chat/types/entities/onboarding-guide.ts` (re-exported
 * from `components/chat` through `./types/*`). A duplicate path
 * triggers TypeScript's TS2308 ambiguous re-export at the top-level
 * `components/index.ts` barrel — same gotcha documented for
 * `RoadmapItem` at `shared/roadmap/index.ts:1-14`.
 *
 * Consumers needing the row type:
 *   import type { OnboardingGuide } from
 *     '@flamingo-stack/openframe-frontend-core/components/chat'
 */

export {
  OnboardingGuidesCatalogView,
  type OnboardingGuidesCatalogViewProps,
} from './onboarding-guides-catalog-view'
export {
  OnboardingGuideDetailView,
  type OnboardingGuideDetailViewProps,
} from './onboarding-guide-detail-view'
export {
  OnboardingGuidesCatalogSkeleton,
} from './onboarding-guides-catalog-skeleton'

export {
  useOnboardingGuides,
  useOnboardingGuide,
  useOnboardingGuideSections,
  onboardingGuideKeys,
} from './hooks/use-onboarding-guides'

'use client'

/**
 * Help Center pages — ready-made, full-page components (each owns the canonical
 * `PageShell` + `PageLayout` chrome) so a host route is a one-line mount with NO
 * local wrapper. Shared by openframe-frontend (self-fetch via the `/content`
 * proxy, mounted under `/help-center/*`) and multi-platform-hub (SSR with
 * server-fetched `initialData` + `generateMetadata`/JSON-LD kept in the server
 * route). Endpoint config + SSR data + optional slots are passed as props.
 *
 * This barrel ALSO re-exports the already-existing full-pages (FAQ / Legal /
 * Release detail / Onboarding detail / Docs / Tickets) so consumers have ONE
 * import site for "help center pages". Re-exports are NAMED (not `export *`) to
 * avoid TS2308 ambiguous-re-export collisions, and this barrel is intentionally
 * NOT merged into the top-level `components/index.ts`.
 */

// New combined pages. (The Help Center *index* landing is intentionally NOT
// here — it stays a host-local page; its links + icons are app-specific.)
export { RoadmapPage, type RoadmapPageProps } from './roadmap-page'
export { ProductReleasesListPage, type ProductReleasesListPageProps } from './product-releases-list-page'
export { DeliveryPage, type DeliveryPageProps } from './delivery-page'
export {
  OnboardingGuidesCatalogPage,
  type OnboardingGuidesCatalogPageProps,
} from './onboarding-guides-catalog-page'

// Existing full-pages re-exported for a single Help Center import site.
export { FaqDocumentPage, type FaqDocumentPageProps } from '../faq'
export { LegalDocumentPage, type LegalDocumentPageProps } from '../shared/legal-document'
export {
  ReleaseDetailPage,
  type ReleaseDetailPageProps,
  type VideoDisplaySectionProps,
} from '../shared/product-release'
export {
  OnboardingGuideDetailView,
  type OnboardingGuideDetailViewProps,
} from '../onboarding-guides'
export { DocsHubPage } from '../docs'
export { HelpCenterList } from '../tickets'

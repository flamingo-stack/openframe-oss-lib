"use client"

export { ProductReleaseCard, type ProductReleaseCardProps } from './product-release-card'
export { ProductReleaseCardSkeleton, type ProductReleaseCardSkeletonProps } from './product-release-card-skeleton'
export {
  ProductReleasesView,
  type ProductReleasesViewProps,
  type ProductReleaseCardExtras,
} from './product-releases-view'
export {
  ReleaseDetailPage,
  type ReleaseDetailPageProps,
  type VideoDisplaySectionProps,
  type MarkdownRendererProps,
  type RoadmapItem,
} from './release-detail-page'
// NOTE: `RoadmapSectionProps` / `DeliverySectionProps` (the injectable-
// component slot types for ReleaseDetailPage) are intentionally NOT
// re-exported from this barrel — they collide with the prop types of
// the concrete `<RoadmapGrid>` / `<DeliverySection>` components in
// `./shared/{roadmap,delivery}` (TS2308 ambiguous re-export at the
// top-level `components/index.ts` barrel). The slot types remain
// internal to `release-detail-page.tsx`; consumers needing them can
// import directly from
// `@flamingo-stack/openframe-frontend-core/components/shared/product-release/release-detail-page`.
// DeliveryResponse re-sourced from the canonical types module so the
// public deep-import path `@flamingo-stack/openframe-frontend-core/components`
// keeps resolving (hub's components/releases/release-detail-page.tsx
// imports it through this barrel).
export type { DeliveryResponse } from '../../../types/delivery'
export { ReleaseDetailSkeleton } from './release-detail-skeleton'

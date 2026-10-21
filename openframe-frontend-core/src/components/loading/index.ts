'use client';

// Page layout skeletons
export {
  SearchContainerSkeleton,
  CategorySidebarSkeleton,
  BreadcrumbSkeleton,
  BreadcrumbLinkSkeleton,
  ResultsHeaderSkeleton,
  VendorGridSkeleton,
} from './page-layout-skeleton';

// Card skeleton components
export { CardSkeleton, CardSkeletonGrid } from './card-skeleton';

// Unified skeleton components
export {
  UnifiedSkeleton,
  TextSkeleton,
  TextLineSkeleton,
  MediaSkeleton,
  InteractiveSkeleton,
} from './unified-skeleton';

// New unified loading components
export { ContentLoadingContainer, useContentLoading } from '../content-loading-container';

export { CategoryCardSkeleton } from './category-card-skeleton';

// Deprecated (kept for hosts on an older release; a component draws its own skeleton now)
export { MspProfileFormSkeleton } from './msp-profile-form-skeleton';
export { SettingsFormSkeleton, type SettingsFormSkeletonProps } from './settings-form-skeleton';
export { CategoryVendorSelectorSkeleton } from './category-vendor-selector-skeleton';
export { BlogCardGridSkeleton, SlackCommunitySkeleton } from './deprecated-layout-skeletons';

// Note: OpenmspHeartbeatLoader is a client-only component and should be
// imported directly from "./openmsp-heartbeat" in client components. Do NOT
// export it here, otherwise server components that import this index will
// break due to client-only code.

export { LoadingRegion, type LoadingRegionProps, LoadingStatus } from './loading-region';
export { LoadingFallback, LoadingSuspense } from './loading-fallback';

export { MarginReportSkeleton } from './margin-report-skeleton';

// Organization & Device skeleton components
export { OrganizationIconSkeleton } from './organization-icon-skeleton';
export { OrganizationCardSkeleton, OrganizationCardSkeletonGrid } from './organization-card-skeleton';
export { DeviceCardSkeleton } from './device-card-skeleton';

'use client';

// Page layout skeletons
export {
  AnnouncementBarSkeleton,
  HeroSkeleton,
  SearchContainerSkeleton,
  CategorySidebarSkeleton,
  BreadcrumbSkeleton,
  BreadcrumbLinkSkeleton,
  ResultsHeaderSkeleton,
  TwoColumnLayoutSkeleton,
  ArticleLayoutSkeleton,
  VendorDetailLayoutSkeleton,
  StatsSectionSkeleton,
  SlackCommunitySkeleton,
  BlogCardGridSkeleton,
  VendorGridSkeleton,
} from './page-layout-skeleton';

// Card skeleton components
export { CardSkeleton, CardSkeletonGrid } from './card-skeleton';

// Unified skeleton components
export { UnifiedSkeleton, TextSkeleton, MediaSkeleton, InteractiveSkeleton } from './unified-skeleton';

// New unified loading components
export { ContentLoadingContainer, useContentLoading } from '../content-loading-container';

// Profile system loading skeleton
export { ProfileLoadingSkeleton } from '../profile/ProfileLoadingSkeleton';

export { MspProfileFormSkeleton } from './msp-profile-form-skeleton';

export { SettingsFormSkeleton, type SettingsFormSkeletonProps } from './settings-form-skeleton';

export { CategoryCardSkeleton } from './category-card-skeleton';

export { CategoryVendorSelectorSkeleton } from './category-vendor-selector-skeleton';

export { WizardLayoutSkeleton } from './wizard-layout-skeleton';

// Note: OpenmspHeartbeatLoader is a client-only component and should be
// imported directly from "./openmsp-heartbeat" in client components. Do NOT
// export it here, otherwise server components that import this index will
// break due to client-only code.

export { LoadingRegion, type LoadingRegionProps } from './loading-region';

export { MarginReportSkeleton } from './margin-report-skeleton';

// Organization & Device skeleton components
export { OrganizationIconSkeleton } from './organization-icon-skeleton';
export { OrganizationCardSkeleton, OrganizationCardSkeletonGrid } from './organization-card-skeleton';
export { DeviceCardSkeleton, DeviceCardSkeletonGrid } from './device-card-skeleton';

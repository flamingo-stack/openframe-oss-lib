'use client';

// New unified loading components
export {
  ContentLoadingContainer,
  useContentLoading,
} from '../content-loading-container';
// Profile system loading skeleton
export { ProfileLoadingSkeleton } from '../profile/ProfileLoadingSkeleton';
// Card skeleton components
export {
  CardSkeleton,
  CardSkeletonGrid,
} from './card-skeleton';
export { CategoryCardSkeleton } from './category-card-skeleton';
export { CategoryVendorSelectorSkeleton } from './category-vendor-selector-skeleton';
// Content skeleton components
export {
  CommentSkeleton,
  FeatureListSkeleton,
  FormSkeleton,
  ListSkeleton,
  NavigationSkeleton,
  ParagraphSkeleton,
  PricingSkeleton,
  ProfileSkeleton,
  TableSkeleton,
  TimelineSkeleton,
} from './content-skeleton';

export { MspProfileFormSkeleton } from './msp-profile-form-skeleton';
// Page layout skeletons
export {
  AnnouncementBarSkeleton,
  ArticleLayoutSkeleton,
  BlogCardGridSkeleton,
  BreadcrumbSkeleton,
  CategorySidebarSkeleton,
  HeroSkeleton,
  ResultsHeaderSkeleton,
  SearchContainerSkeleton,
  SlackCommunitySkeleton,
  StatsSectionSkeleton,
  TwoColumnLayoutSkeleton,
  VendorDetailLayoutSkeleton,
  VendorGridSkeleton,
} from './page-layout-skeleton';
// Unified skeleton components
export {
  InteractiveSkeleton,
  MediaSkeleton,
  TextSkeleton,
  UnifiedSkeleton,
} from './unified-skeleton';

export { WizardLayoutSkeleton } from './wizard-layout-skeleton';

// Note: OpenmspHeartbeatLoader is a client-only component and should be
// imported directly from "./openmsp-heartbeat" in client components. Do NOT
// export it here, otherwise server components that import this index will
// break due to client-only code.

// Dynamic ODS-aware skeleton components
export {
  DynamicSkeleton,
  PlatformSkeletonContainer,
  ProgressiveSkeleton,
  SkeletonPresets,
} from '../dynamic-skeleton';
export { DeviceCardSkeleton, DeviceCardSkeletonGrid } from './device-card-skeleton';
export { MarginReportSkeleton } from './margin-report-skeleton';
export { OrganizationCardSkeleton, OrganizationCardSkeletonGrid } from './organization-card-skeleton';
// Organization & Device skeleton components
export { OrganizationIconSkeleton } from './organization-icon-skeleton';
export { UsersGridSkeleton } from './users-grid-skeleton';

// Centralized type exports for @flamingo/ui-kit
// All platform and application types are available from this single export

export * from './access-code-cohorts';
// Core platform types
export * from './announcement';
// Authentication types
export * from './auth';
// Content types
export * from './blog';
export * from './case-study';
export type { Category, CategoryCardProps, RealCategoryCardProps } from './categories';
export * from './category';
export * from './customer-interview';
export * from './customer-interview-ai.types';
// User and profile types
export * from './employee';
// Business logic types
export * from './faq';
export * from './icons';
export * from './luma';
// Marketing types
export * from './marketing';
export * from './media';
// Navigation types
export * from './navigation';
// OS types
export * from './os.types';
export * from './permissions';
export type {
  LegacyPlatform,
  PlatformConfig as PlatformSettings,
  PlatformFilter,
  PlatformName,
  PlatformOption,
  PlatformRecord,
  PlatformStats,
} from './platform';
export * from './product-release';
export * from './profile';
export * from './report';
// Shell types
export * from './shell.types';
// Communication types
export * from './slack';
export * from './stack';
// Database and API types
export * from './supabase';
export * from './team';
export * from './tmcg';
// Tool types
export * from './tool.types';
export * from './user';
export * from './vendor';
export * from './vendor-links';
export * from './waitlist';

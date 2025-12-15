// Centralized type exports for @flamingo/ui-kit
// All platform and application types are available from this single export

// Core platform types
export type { PlatformName, PlatformRecord, PlatformConfig as PlatformSettings, PlatformOption, PlatformFilter, LegacyPlatform, PlatformStats } from './platform'
export type { Announcement, AnnouncementFormData } from './announcement'
export type { CategoryCardProps, Category, RealCategoryCardProps } from './categories'
export * from './category'
export * from './media'

// Database and API types
export * from './supabase'

// Authentication types
export * from './auth'

// Content types
export * from './blog'
export * from './case-study'
export * from './product-release'
export * from './luma'
export * from './vendor'
export * from './vendor-links'

// User and profile types
export * from './user'
export type { ProfileData, ProfileResponse } from './profile'
export * from './team'
export * from './employee'

// Communication types
export * from './slack'
export * from './waitlist'

// Business logic types
export * from './stack'
export * from './report'
export * from './faq'

// Navigation types
export * from './navigation'

// Tool types
export * from './tool.types'

// Shell types
export * from './shell.types'

// OS types
export * from './os.types'
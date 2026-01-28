// Centralized type exports for @flamingo/ui-kit
// All platform and application types are available from this single export

// Core platform types
export type { Announcement, AnnouncementFormData } from './announcement'
export type { Category, CategoryCardProps, RealCategoryCardProps } from './categories'
export * from './category'
export * from './media'
export type { LegacyPlatform, PlatformFilter, PlatformName, PlatformOption, PlatformRecord, PlatformConfig as PlatformSettings, PlatformStats } from './platform'

// Database and API types
export * from './supabase'

// Authentication types
export * from './auth'

// Content types
export * from './blog'
export * from './case-study'
export * from './customer-interview'
export * from './luma'
export * from './product-release'
export * from './vendor'
export * from './vendor-links'

// User and profile types
export * from './employee'
export type { ProfileData, ProfileResponse } from './profile'
export * from './team'
export * from './user'

// Communication types
export * from './slack'
export * from './waitlist'

// Business logic types
export * from './faq'
export * from './report'
export * from './stack'

// Navigation types
export * from './navigation'

// Tool types
export * from './tool.types'

// Shell types
export * from './shell.types'

// OS types
export * from './os.types'

// Marketing types
export * from './marketing'

export * from './icons'
export * from './permissions'

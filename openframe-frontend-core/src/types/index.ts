// Centralized type exports for @flamingo/ui-kit
// All platform and application types are available from this single export

// Core platform types
export * from './announcement'
// Doc-source viewer types — DocNode / DocContent / DocSourceDal /
// DocRenderHandlers. Consumed by knowledge-base, data-room, and future
// doc-source viewers.
export * from './doc-source'
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
export * from './entity-author'
export * from './case-study'
export * from './customer-interview'
export * from './customer-interview-ai.types'
export * from './luma'
export * from './product-release'
export * from './delivery'
export * from './vendor'
export * from './vendor-links'
export * from './video-processing'

// User and profile types
export * from './employee'
export * from './profile'
export * from './team'
export * from './user'

// Communication types
export * from './slack'
export * from './waitlist'

// Business logic types
export * from './faq'
export * from './content-ref'
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

export * from './access-code-cohorts'
export * from './icons'
export * from './permissions'
export * from './tmcg'


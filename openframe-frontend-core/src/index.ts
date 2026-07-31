// Main export file for @flamingo/ui-kit
export * from './components/ui'
export * from './components/features'
export * from './components/icons'
export * from './components/navigation'
export * from './components/platform'
// Chat exports
export * from './components/chat'
// Onboarding exports
export * from './components/shared/onboarding'
// Logs components
export { LogsList } from './components/logs-list'
export { LogSeverityDot } from './components/log-severity-dot'
export { ToolIcon } from './components/tool-icon'
export * from './types/logs.types'
export * from './hooks'
export * from './utils'
export * from './types'
export * from './assets'

// Disambiguation: these names are star-exported by BOTH './components/chat'
// (chat entity-card payload types) and './types' (CMS domain types). With two
// star exports TypeScript treats the names as ambiguous and DROPS them from
// this barrel (consumers see TS2308). Explicitly re-export the CMS domain
// shapes as canonical here; the chat payload variants stay available from the
// './components/chat' subpath.
export type {
  BlogAuthor,
  BlogCategory,
  BlogMediaAsset,
  BlogPagination,
  BlogPost,
  BlogPostCategory,
  BlogPostPlatform,
  BlogPostSummary,
  BlogPostTag,
  BlogSearchParams,
  BlogStatus,
  BlogTag,
  CaseStudy,
  CaseStudyFilters,
  CaseStudyListResponse,
  CustomerInterview,
  CustomerInterviewConfig,
  CustomerInterviewFilters,
  CustomerInterviewListResponse,
} from './types'
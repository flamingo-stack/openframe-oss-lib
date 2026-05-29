"use client"

// Components exports
export * from './chat'
export * from './features'
export * from './icons'
export * from './navigation'
export * from './platform'
export * from './ui'

// Individual component exports
export * from './announcement-bar'
export * from './hover-card'
export * from './categories-cart'
export * from './category-card'
export * from './comment-card'
export * from './content-loading-container'
export * from './dynamic-skeleton'
export * from './empty-state'
export * from './faq-accordion'
export * from './filter-chip'
export * from './footer'
export * from './unified-filter-logic'
export * from './unified-pagination'
export * from './footer-waitlist-button'
export * from './hero-image-uploader'
export * from './icons-block'
export * from './image-cropper'
export * from './media-carousel'
export * from './metric-value'
export * from './msp-display'
export * from './open-source-features'
export * from './pagination'
export * from './persistent-filter-controls'
export * from './persistent-pagination'
export * from './pricing-display'
export * from './results-count'
export * from './selection-source-badge'
export * from './social-icon-row'
export * from './user-display'
export * from './vendor-display-button'
export * from './vendor-icon'
export * from './vendor-page-skeleton'
export * from './vendor-tag'
export * from './why-it-matters'
export * from './yes-no-display'
// Removed duplicate PageContainer export - already exported from './ui/page-container'
export * from './made-with-love'

// Loading components
export * from './loading'

// Auth-related exports
export * from './auth-stub'

// Date/Time components
export * from './date-time-picker'

// Chat components
export * from './chat'

// Onboarding components
export * from './shared/onboarding'

// Doc-search bar — unified RAG-search dropdown used by the data-room
// sidebar AND the onboarding-guide catalog. Pure presentation; hosts
// own the `useDocSearch` hook and pass results in as props.
export * from './shared/doc-search'

// Product Release components
export * from './shared/product-release'

// Dev-center shared components (Roadmap / Delivery / DevSectionView chrome)
export * from './shared/dev-section'
export * from './shared/roadmap'
export * from './shared/delivery'

// Legal-document shared component (privacy policy, terms of service)
export * from './shared/legal-document'

// Detail Page Skeleton
export { DetailPageSkeleton, type DetailPageSkeletonProps } from './shared/detail-page-skeleton'

// Priority UI components that exist in main components directory
// Note: These are re-exported from ./ui already, no need to duplicate

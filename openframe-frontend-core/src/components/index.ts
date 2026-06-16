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
// FaqSection sub-folder. Also exposed via the "./components/faq" subpath export
// in package.json — that subpath is ALSO `"use client"` (tsup banner), so it
// avoids dragging the rest of this root barrel but is NOT server-safe.
//
// Server Components that need the pure-fn JSON-LD builder MUST import from the
// dedicated server-safe subpath "./components/faq/json-ld" (built without the
// client banner under the server/universal block of tsup.config.ts).
export * from './faq'
export * from './related-content'
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

// Author byline card (end-of-article author description) — embeddable via
// embed-shims + optional-runtime avatar proxying; hosts pass their own
// fallbackBio copy (the hub uses defaultAuthorFallbackBio()).
export { ArticleAuthorByline, type ArticleAuthorBylineProps } from './shared/article-author-byline'

// Read-only media gallery strip (horizontal scroll; images → lightbox, clips →
// inline Video). Single source of truth for the detail-page media gallery —
// used by product-release + What I Shipped detail pages.
export { MediaGalleryStrip, type MediaGalleryStripItem, type MediaGalleryStripProps } from './shared/media-gallery-strip'

// Author detail-page body (identity + socials + bio + expertise, rail as
// children) — the one implementation behind /authors/[slug] and embedded
// author pages.
export { AuthorDetailView, type AuthorDetailViewProps } from './authors/author-detail-view'

// Priority UI components that exist in main components directory
// Note: These are re-exported from ./ui already, no need to duplicate

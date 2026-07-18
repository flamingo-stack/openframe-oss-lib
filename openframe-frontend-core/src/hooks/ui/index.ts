// UI Hooks exports
export * from './use-auto-limit-tags'
export * from './use-debounce'
export * from './use-deferred-error'
export * from './use-focus-trap'
export * from './use-header-height'
export * from './use-horizontal-scrollbar'
export * from './use-image-edge-color'
export * from './use-local-storage'
export * from './use-marquee-engine'
export * from './use-media-query'
export * from './use-memoized-callback'
export * from './use-notification-permission'
export * from './use-onboarding-state'
export * from './use-search'
export * from './use-suppress-clone-focus'
export * from './use-table-pagination'
export * from './use-throttle'
export * from './use-window-size'

// Shared ref-counted, iOS-aware body scroll lock (react-aria). Re-exported so
// hub/app consumers have one import path; lib internals may import the
// package directly (npm dedupes to one module instance either way).
export { usePreventScroll } from '@react-aria/overlays'

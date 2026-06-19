// Hooks exports
export * from './ui'
export * from './platform'
export * from './use-toast'
export * from './use-contact-submission'
export * from './use-quick-action-hint'
export * from './use-copy-to-clipboard'

// Image authentication hooks
export * from './use-batch-images'
export * from './use-authenticated-image'

// URL State Management hooks
export * from './state'

// NATS hooks
export * from './nats/use-nats-client'

// Viewport / lazy-mount primitive (shared IO singleton)
export * from './use-near-viewport'

// Access code integration — pairs with the standalone helpers in
// `utils/access-code-client`. Lives in `hooks/` so the createContext
// pulled in via EndpointsRuntimeContext doesn't end up in the
// server-safe utils bundle.
export * from './use-access-code-integration'

// OG placeholder URL builder hook (requires host-supplied URL builder)
export * from './use-og-placeholder'

// Deep-link "scroll to URL hash" after data loads. Pairs with URL
// composers that emit `?<filter>=<id>#<prefix>-<id>` — the filter
// narrows the list, the hash scrolls the matching DOM id.
export * from './use-scroll-to-hash'

// Invisible bot-protection client primitive (honeypot ref + submit-timing).
// Pairs with the server-safe decision fn in `utils/humanity-signals`.
export * from './use-humanity-signals'

// Utils exports - client-side only
export { cn } from './cn'
// Platform→domain SSOT lives in `../platform-domains` (single definition). Re-exported
// here so existing `/utils` callers keep working; the new resolver/helpers
// (getPlatformByHostname/hostOf/expandWwwApex/…) are exposed via the `/platform-domains`
// subpath ONLY (one import surface for the new API).
export { getPlatformProductionUrl, getAllPlatformBaseDomains } from '../platform-domains'
// Number / currency / byte / date formatters live in `./format` (single
// source of truth). Re-exported here so existing callers that pull from
// the barrel keep working without changing imports.
export { formatDate, formatNumber, formatPrice, formatBytes } from './format'
// SVG path constants — re-exported here (server-safe) because icons-v2 has "use client"
export { PLAY_ICON_PATH } from '../components/icons-v2-generated/media-playback/play-icon'
export { getPlatformAccentColor, getCurrentPlatform, type ColorCategory, HEX_PATTERN } from './ods-color-utils'
export { delay, generateRandomString, truncateString, deepClone, getSlackCommunityJoinUrl } from './common'
export { getBaseUrl } from '../utils/cn'

export * from './platform-config'
export * from './os-platforms'
export * from './access-code-client'
// Validation utilities
export * from './validation-utils'
// Note: format and date-utils are imported via cn.ts to avoid duplicates
// AI confidence utilities
export * from './confidence-helpers'
// Release date formatting utilities
export * from './date-formatters'
// Product-release card helpers (lifted from the hub so every embedder gets the
// rich card metadata): badge-color mapping + cover-image fallback resolution.
export * from './release-badge'
export * from './release-cover'
// Dev-center URL param keys — the ONE source for the `?search=` / `?status=` / … keys the
// chrome registry writes and the list views read; re-exported so embedders (and the hub's
// dev-section-url helper) build deep-links with the same keys instead of a bare literal.
export { DEV_SECTION_PARAM_KEYS } from './dev-sections/dev-section-param-keys'
// Dynamic icon registry — single source of truth lives at
// components/chat/utils/icon-registry. Re-exported here so existing
// `@flamingo-stack/openframe-frontend-core/utils` callers (hub admin
// social-account screens) keep working without changing their import path.
export {
  getDynamicIcon,
  type DynamicIconSize,
  ICON_REGISTRY,
  getIconComponent,
  normalizeIconKey,
} from '../components/chat/utils/icon-registry'
export { getPlatformIconComponent as getPlatformLogo } from './platform-config'
// Tool type utilities
export * from './tool-utils'
// Shell type utilities
export * from './shell-utils'
// OS type utilities
export * from './os-utils'
// Phone utilities
export * from './country-phone-utils'
// Generic domain detection
export * from './generic-domain-utils'

// Color analysis (canvas-based image color extraction)
export * from './color-analysis'

// Image-proxy URL builder (pure, runtime-configurable)
export {
  type GetProxiedImageUrlOptions,
  getProxiedImageUrl,
  urlPathLooksLikeSvg,
  shouldProxyImage,
  generateImageSizes,
} from './image-proxy'

// Number / byte / duration / time / UTC date / initials / metric /
// trend / range / text helpers — single canonical home for every
// generic formatter consumed across the lib AND the hub. Hub keeps
// only vendor-specific helpers (formatClassification / formatPricingModel
// in `lib/utils/vendor-text.ts`).
export {
  formatLargeNumber,
  formatAbbreviatedNumber,
  nameInitials,
  getFirstLastInitials,
  formatDurationMMSS,
  formatDurationCompact,
  formatTimeWithTimezone,
  formatDurationFromRange,
  type FormatDateUTCOptions,
  formatDateUTC,
  formatCurrency,
  formatPercent,
  formatWholeDollars,
  formatLegalDate,
  formatBytesShort,
  formatDateTimeAt,
  formatDurationFromMs,
  type MetricFormat,
  type TrendPolarity,
  formatCompactMetric,
  getTrendColors,
  formatDateRange,
  formatDuration,
  formatUnderscoreText,
  stripHtml,
  formatBioText,
  formatClassification,
  formatPricingModel,
} from './format'

// Date / time helpers (relative, absolute, range checks, UTC timestamp)
export {
  formatRelativeTime,
  formatAbsoluteDate,
  formatDateTime,
  getDetailedTimeDifference,
  isToday,
  isWithinMinutes,
  createUTCTimestamp,
} from './date-utils'

// Chat source-icons + labels (server-safe — lives here in src/utils/
// instead of src/components/chat/utils/ so server-side hub callers like
// doc-chat-utils can use them without tripping the 'use client' boundary)
export {
  SOURCE_ICON_NAMES,
  getSourceIconName,
  SOURCE_LABELS_BY_TABLE,
  getSourceLabel,
} from './source-icons'

// Embed-surface auth — generic across chat AND ticket center (and any
// future embedded React component that needs to identify as the proxied
// customer). Wire headers / env vars / storage key are unchanged
// (`X-Chat-*`, `CHAT_PROXY_SECRET`, `chat.proxy-auth.v1`) — those are
// server / deployment contracts. The CLIENT-side rename frees non-chat
// surfaces from importing a chat-prefixed symbol. Old chat-prefixed
// aliases are kept as @deprecated re-exports at
// `components/chat/utils/chat-authed-fetch.ts` + `chat-proxy-auth-storage.ts`.
export {
  embedAuthedFetch,
  setEmbedAuthAdapter,
  type EmbedAuthAdapter,
} from './embed-authed-fetch'
export {
  type EmbedProxyAuth,
  getEmbedProxyAuth,
  setEmbedProxyAuth,
  clearEmbedProxyAuth,
  getPersistedProxyEmail,
  applyProxyAuth,
} from './embed-proxy-auth-storage'

// SSE leading-frame reader for the chat-agent `confirm-tool` route.
// Used by the ticket center to drain the single `decision_resolved`
// frame the server emits when `messages: []` is in the request body.
export {
  readLeadingDecisionFrame,
  type DecisionResolvedFrame,
} from './sse-decision-frame'

// Pure text/wire helpers that originated under components/chat/utils/
// but are needed by SERVER-SIDE hub callers (doc-chat-utils,
// hubspot-files-utils, rag-mappers). Re-exporting through utils/ keeps
// them out of the 'use client' bundle. The chat-side re-export chain
// stays intact for client consumers via components/chat barrel.
export {
  escapeMarkdownInline,
  type ChatAttachment,
  buildChatAttachmentViewUrl,
  formatChatAttachmentMarkdownForBubble,
  CHAT_ATTACHMENT_VIEW_URL_PREFIX,
  CHAT_ATTACHMENT_VIEW_TOKEN_QUERY_PARAM,
  ANTHROPIC_SUPPORTED_IMAGE_MIME,
  CHAT_ATTACHMENT_VIEW_URL_PREFIX_REGEX_ESCAPED,
  CHAT_ATTACHMENT_MARKDOWN_PATTERN,
  stripChatAttachmentMarkdown,
} from '../components/chat/utils/chat-attachment-markdown'
export {
  AUTO_CONTINUATION_DIRECTIVE_PREFIX,
  buildAutoContinuationDirective,
  type BuildAutoContinuationOptions,
} from '../components/chat/utils/auto-continuation-directive'
export { flattenAssistantContent } from '../components/chat/utils/flatten-assistant-content'
export {
  SCROLL_ANCHOR,
  type ScrollAnchor,
  SCROLL_ANCHOR_WIRE_KEY,
  parseScrollAnchor,
} from '../components/chat/utils/scroll-anchor'
export {
  type WireCommandOverride,
  parseWireCommandOverride,
  sanitizeTitleForChat,
  formatSingularLookupInvocation,
  type CommandOverride,
  extractEntityIdFilter,
  buildDiscussAddendum,
} from '../components/chat/utils/slash-dispatch-utils'

// ClickUp taxonomy constants + label resolver — server-safe so the
// delivery aggregator + sync engine can read CUSTOM_ITEM_ID.BUG/.REQUEST
// without going through the 'use client' chat barrel (which erases the
// values to undefined when imported from server code).
export { CUSTOM_ITEM_ID, getTaskTypeLabel } from '../components/chat/utils/clickup-task-type-utils'

// Status color scheme + clickup URL helpers (pure, server-safe)
export { type ColorScheme, getStatusColorScheme } from '../components/chat/utils/agent-status-message'
export { clickupTaskUrl } from '../components/chat/utils/external-app-urls'

// Cross-origin URL detection (pure — used by server-side rag-mappers
// + content-url-builder for cross-origin same-tab decisions)
export { isCrossOriginUrl } from '../components/chat/utils/is-cross-origin-url'

// React-version-aware `fetchpriority` prop builder — spread into `<img>`
// / `<iframe>` so the rendered DOM attribute is correct under React 18
// (lowercase) AND React 19 (camelCase) without console warnings.
export { fetchPriorityProp, type FetchPriorityValue } from './fetch-priority'

// Dev-center section registry (Roadmap / Delivery / Releases / Onboarding) —
// server-safe (no JSX, no contexts/* imports); imported by route-page
// `metadata` exports + the shared `<DevSectionView>` chrome.
export * from './dev-sections'

// Canonical "smooth scroll element into view with sticky-chrome
// offset" helper. Single source of truth across the lib + hub for
// pre-computed-target scrolling — see `scroll-into-view.ts` for the
// rationale (TL;DR: window.scrollTo({top, behavior:'smooth'}) with a
// pre-computed pixel value avoids the mid-animation jitter that
// `element.scrollIntoView()` produces when layout shifts during the
// scroll).
export {
  type ScrollElementIntoViewOptions,
  scrollElementIntoView,
} from './scroll-into-view'

// Shared list-API URL builder — the single source for the per-type chat
// entity-card fetch shapes. The hub's 12 RAG mapper `listApi` closures
// delegate here (byte-parity test guards the migration); embedders wire
// `endpoints.buildListUrl = (t, ids) => buildListUrl(t, ids, '/content')`.
// Pure + server-safe (the hub imports it server-side from this barrel).
export { buildListUrl, canonicalContentRefType } from './list-url'

// Content-ref group registry (labels/order/layout per rail type) + list-API
// response normalizers + the shared suggestion-fetch URL composer — all
// pure + server-safe; the hub re-exports these from its config/util shims.
export {
  CONTENT_REF_GROUPS,
  getContentRefLabel,
  getContentRefLabelOrTitleCase,
  orderContentRefTypes,
  type ContentRefGroupConfig,
  type ContentRefLayout,
  type ContentRefGridSize,
} from './content-ref-groups'
export { extractItems, extractItemId } from './extract-items'
export { buildSuggestionUrl, type SuggestionUrlOptions } from './suggestion-url'

// Embedder-configurable content-URL composer for the existing
// `runtime.composeContentUrl` seam — relative href for host-served types,
// hub origin for the rest. Pure + server-safe.
export {
  DEFAULT_CONTENT_SUFFIXES,
  makeComposeContentUrl,
  buildDefaultHref,
  type ContentHrefOptions,
  type ComposeContentUrl,
} from './content-href'

// Invisible bot-protection signals (honeypot + timing) — pure + server-safe so
// the hub's per-route `verifyHuman` gate imports the SAME `evaluateHumanitySignals`
// decision fn the lib forms feed. Also exported via the granular subpath
// `./utils/humanity-signals` for server-only consumers.
export * from './humanity-signals'

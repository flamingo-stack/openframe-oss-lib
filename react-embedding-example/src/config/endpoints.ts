// Every hub path derived from CONTENT, exactly once. The runtime factory, the
// data layer, and the pages all read from EP — no page re-interpolates `${CONTENT}`,
// no endpoint literal exists twice.
import { CONTENT } from './content'

// approvalToolUrl + (once the optional lib seam lands) the three tickets paths
// all derive from this one agent base, so `/chat/agent` lives in a single spot.
const AGENT_BASE = `${CONTENT}/chat/agent`

export const EP = {
  // chat
  chatStream: `${CONTENT}/docs/chat`,
  commands: `${CONTENT}/docs/commands`,
  // OpenFrame AI agents (Fae/Mingo) — public per-agent display config. Drives
  // EmbeddableChat "agent mode" via runtime.endpoints.aiAgentConfigUrl.
  aiAgent: (slug: string) => `${CONTENT}/ai-agents/${slug}`,
  docsSearch: `${CONTENT}/docs/search`,
  // doc sources (knowledge-base mounts <DocsHubPage> against these)
  docsStructure: (sourceId: string) => `${CONTENT}/docs/sources/${sourceId}/structure`,
  docsContent: (sourceId: string) => `${CONTENT}/docs/sources/${sourceId}/content`,
  // POST internal-link resolver. Lives under `/api/docs/` alongside the other
  // doc-scoped endpoints (structure, content, search). The DocViewer threads
  // `handlers.onResolveLink` into the markdown renderer for relative hrefs
  // like `./getting-started/intro.md`. Wired into
  // `ChatRuntime.endpoints.docsResolveLinkUrl` (see content-runtime.ts) so
  // the renderer picks it up without an explicit prop on <DocsHubPage>.
  resolveLink: `${CONTENT}/docs/resolve-link`,
  agentBase: AGENT_BASE,
  approval: `${AGENT_BASE}/confirm-tool`,
  attachmentUpload: `${CONTENT}/storage/generate-upload-url`,
  attachmentViewPrefix: `${CONTENT}/storage/view/chat-attachments/`,
  identity: `${CONTENT}/auth/identity`,
  imageProxy: `${CONTENT}/image-proxy`,
  ogPlaceholder: (title: string) => `${CONTENT}/og-placeholder?title=${encodeURIComponent(title)}`,
  // roadmap
  roadmap: `${CONTENT}/roadmap`,
  roadmapVote: `${CONTENT}/roadmap/vote`,
  roadmapById: (id: string) => `${CONTENT}/roadmap/${id}`,
  // delivery — `delivery` is the base route that takes `?task_ids=` and returns
  // BOTH `{ completed, inProgress }` (the release-detail bug-fixes/enhancements
  // section uses this); the two list endpoints feed the standalone /delivery page.
  delivery: `${CONTENT}/delivery`,
  deliveryCompleted: `${CONTENT}/delivery/completed`,
  deliveryInProgress: `${CONTENT}/delivery/in-progress`,
  // onboarding guides
  onboarding: `${CONTENT}/onboarding-guides`,
  onboardingBySlug: (slug: string) => `${CONTENT}/onboarding-guides/${slug}`,
  onboardingSections: `${CONTENT}/onboarding-guides/sections`,
  // product releases (the hub's public routes are /api/releases + /api/releases/[slug])
  productReleases: `${CONTENT}/releases`,
  productReleaseBySlug: (slug: string) => `${CONTENT}/releases/${slug}`,
  // misc surfaces
  legal: (docType: string) => `${CONTENT}/legal/${docType}`,
  contact: `${CONTENT}/contact`,
  announcements: `${CONTENT}/announcements/active`,
  accessValidate: `${CONTENT}/validate-access-code`,
  accessConsume: `${CONTENT}/consume-access-code`,
  // Rich-markdown embedded surfaces (reddit/twitter cards + OG link preview).
  // Hub serves these from /api/blog/*, so the proxied paths are /content/api/blog/*.
  redditProxy: `${CONTENT}/blog/reddit-proxy`,
  twitterProxy: `${CONTENT}/blog/twitter-proxy`,
  ogScraper: `${CONTENT}/blog/og-scraper`,
} as const

/** Public hub origin for new-tab "open the full content" links (embed mode). */
export const HUB_PUBLIC_ORIGIN = import.meta.env.VITE_HUB_ORIGIN ?? 'http://localhost:3000'

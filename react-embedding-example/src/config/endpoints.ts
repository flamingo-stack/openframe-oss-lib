// Every hub path derived from CONTENT, exactly once. The runtime factory, the
// data layer, and the pages all read from EP — no page re-interpolates `${CONTENT}`,
// no endpoint literal exists twice.
import { CONTENT } from './content'

// approvalToolUrl + the three conversational ticket tool paths derive from
// this one agent base, so `/chat/agent` lives in a single spot. Ticket
// REALTIME (stream + read receipts) is NOT agent-based — it lives on the
// dedicated `/api/tickets/*` surface below.
const AGENT_BASE = `${CONTENT}/chat/agent`

export const EP = {
  // chat
  chatStream: `${CONTENT}/docs/chat`,
  commands: `${CONTENT}/docs/commands`,
  // Guide-mode empty-state config (greeting + enabled RAG tables + quick-action
  // chips WITH icons). The host injects these at SSR; a cross-origin embedder has
  // no server hop, so EmbeddableChat fetches them here via
  // runtime.endpoints.emptyStateUrl. Without this, Guide mode shows no quick actions.
  emptyState: `${CONTENT}/docs/empty-state`,
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
  // tickets (Help Center) — conversational reads/writes. These three are
  // chat-agent TOOL routes on the hub (`/api/chat/agent/*`), hence
  // AGENT_BASE.
  findTicket: `${AGENT_BASE}/find-ticket`,
  ticketAction: `${AGENT_BASE}/ticket-action`,
  listEngagements: `${AGENT_BASE}/list-engagements`,
  // Ticket REALTIME lives on its OWN surface (`/api/tickets/*`) — not the
  // chat agent prefix. `ticketStream` is a long-lived GET SSE response
  // consumed by the lib's `TicketLiveProvider` (fetch-based reader, works
  // cross-origin with the embed auth adapter's headers). The unread
  // summary has NO endpoint — it arrives as `ticket-summary` frames on
  // the stream; `ticketRead` responses also carry a fresh summary.
  ticketStream: `${CONTENT}/tickets/stream`,
  ticketRead: `${CONTENT}/tickets/read`,
  attachmentUpload: `${CONTENT}/storage/generate-upload-url`,
  attachmentViewPrefix: `${CONTENT}/storage/view/chat-attachments/`,
  identity: `${CONTENT}/auth/identity`,
  imageProxy: `${CONTENT}/image-proxy`,
  // Native track VTT captions route — the lib appends /entityType/entityId?v=...
  // so this is a prefix, not a full URL.
  captions: `${CONTENT}/captions`,
  ogPlaceholder: (title: string) => `${CONTENT}/og-placeholder?title=${encodeURIComponent(title)}`,
  // walkthrough video (per-platform floating demo video)
  walkthroughVideo: `${CONTENT}/walkthrough-video`,
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
  ogScraper: `${CONTENT}/og-scraper`,
  // meeting scheduler directory (the widget itself hits /api/meetings/availability
  // + /api/meetings/book through its apiBaseUrl — see pages/schedule-a-call.tsx)
  meetings: `${CONTENT}/meetings`,
} as const

/** Public hub origin for new-tab "open the full content" links (embed mode). */
export const HUB_PUBLIC_ORIGIN = import.meta.env.VITE_HUB_ORIGIN ?? 'http://localhost:3000'

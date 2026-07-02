// ONE factory for both lib runtime contexts. Every endpoint comes from EP, so the
// `/content` base is the single source. Mounted (memoized) in app-providers.tsx.
import type { ChatRuntime, EndpointsRuntime } from '@flamingo-stack/openframe-frontend-core/contexts'
import { buildListUrl, makeComposeContentUrl, DEV_SECTION_PARAM_KEYS, faqItemAnchor } from '@flamingo-stack/openframe-frontend-core/utils'
import { CONTENT_PREFIX } from '../../proxy/content-prefix.mjs'
import { EP, HUB_PUBLIC_ORIGIN } from '../config/endpoints'

// The content types THIS embedder hosts on its own slugged DETAIL routes (see
// app-routes.tsx: /onboarding-guides/:slug, /releases/:slug). `makeComposeContentUrl`
// returns a relative in-app href `/<suffix>/<slug>` for these (soft-navigates) and the
// canonical hub origin for everything else.
//
// NOTE: the list-filter sections (roadmap, delivery) are deliberately NOT here — they
// have no `/<x>/<slug>` detail page; a chat card / page link deep-links into the
// existing LIST route via `?search=<id>` (see `overrides` below). Suffix logic would
// wrongly produce `/<suffix>/<id>`, so they need an explicit override instead.
const HOSTED_TYPES = new Set(['onboarding_guide', 'product_release'])

// The embedder is platform-agnostic: it does NOT set `source` (the lib types it as
// optional). The chat wire resolves source server-side from the proxied hub's
// currentPlatform(); client-side link decisions fall back to an origin comparison; and
// the chat-history localStorage namespace falls back to a lib constant. So pointing
// HUB_ORIGIN at any platform's hub just works — no platform knob anywhere on the client.
export function buildChatRuntime(): Omit<ChatRuntime, 'source'> {
  return {
    endpoints: {
      chatStreamUrl: EP.chatStream,
      approvalToolUrl: EP.approval,
      commandsUrl: EP.commands,
      // Guide-mode empty-state config (greeting + enabled RAG tables + quick-action
      // chips WITH icons). Injected at SSR in the host; the embedder fetches it here
      // (see EP.emptyState). Without this, Guide mode renders no quick actions.
      emptyStateUrl: EP.emptyState,
      // OpenFrame agent-mode: EmbeddableChat fetches the per-agent display config
      // (greeting + suggested prompts + source chips) from here when an
      // `activeAgentSlug` is set. See ask-ai.tsx's agent chooser.
      aiAgentConfigUrl: (slug: string) => EP.aiAgent(slug),
      // In-source RAG search bar (mounted inside <DocsHubPage>) reads this
      // automatically — no need to thread `searchEndpoint` as a prop. Same
      // injection pattern tickets uses for `findTicketUrl`.
      docsSearchUrl: EP.docsSearch,
      // POST link-resolver behind `handlers.onResolveLink` (threaded into the
      // markdown renderer). Without this, relative hrefs like
      // `./getting-started/intro.md` fall through to a verbatim content fetch
      // and 404. Same fall-back chain as `docsSearchUrl`.
      docsResolveLinkUrl: EP.resolveLink,
      // The lib's shared list-URL builder, based at the proxy prefix so it
      // emits `/content/api/...` (the proxy rewrites `/content` → the hub).
      // No hand-rolled per-type table — the lib owns the shapes.
      buildListUrl: (type, ids) => buildListUrl(type, ids, CONTENT_PREFIX),
      attachmentUploadUrl: EP.attachmentUpload,
      // Relative is correct HERE: the proxy is same-origin to the SPA, and the lib's
      // embedAuthedFetch (used by uploads + tickets) rejects cross-origin/absolute URLs.
      attachmentViewUrlPrefix: EP.attachmentViewPrefix,
      identityUrl: EP.identity,
      imageProxyUrlPrefix: EP.imageProxy,
    },
    navigation: {
      // 'host' = this app owns routing. react-router is registered into the lib's
      // embed-shims (embed-router-bridge), so the lib soft-navigates through that
      // router directly — no `navigate` callback or app-side bridge needed.
      mode: 'host',
    },
    // OG-placeholder fallback: NO wiring needed. The lib owns the default URL
    // construction now and derives the route's base from `imageProxyUrlPrefix`
    // above (sibling API route, same `/content/api` base) — so entity cards
    // with no cover image get the branded placeholder automatically. To point
    // it elsewhere, set `endpoints.ogPlaceholderUrl` explicitly.
    // The existing composeContentUrl seam, wired from the lib helper: relative
    // in-app href for the types we host (HOSTED_TYPES), canonical hub origin for
    // the rest. Suffix table is the lib default (DEFAULT_CONTENT_SUFFIXES) — no
    // hand-rolled per-type route map in this app.
    composeContentUrl: makeComposeContentUrl({
      hostedTypes: HOSTED_TYPES,
      contentOrigin: HUB_PUBLIC_ORIGIN,
      // List-filter types deep-link into their EXISTING list route with `?search=<id>`
      // — the param `DevSectionView` writes and `RoadmapView` / `DeliveryLists` read.
      // (Verified against the live hub: /api/roadmap + /api/delivery match the task id
      // in their `search`, returning exactly that one row.) Both page links AND chat
      // cards flow through this one composeContentUrl, so a roadmap/delivery item lands
      // in the SAME filtered place wherever it's rendered. `id` is the row's
      // primary-key id (the ClickUp task id the chat ref carries).
      //
      // Without these, delivery_item would fall through to its server-baked relative
      // `externalUrl` (`/bug-fixes-and-enhancements?search=<id>` — the HUB's route, which
      // 404s in this app), and roadmap_item to a `#hash` the list never reads.
      overrides: {
        roadmap_item: (id) => ({ href: `/roadmap?${DEV_SECTION_PARAM_KEYS.search}=${encodeURIComponent(id)}`, targetPlatform: null }),
        delivery_item: (id) => ({ href: `/delivery?${DEV_SECTION_PARAM_KEYS.search}=${encodeURIComponent(id)}`, targetPlatform: null }),
        // FAQ deep-link: the hub bakes `/faqs#faq-item-<id>` as the card's externalUrl
        // (the canonical HUB origin → opens in a new tab here). Override to the in-app
        // `/faqs` hash so the card soft-navigates instead; `<FaqSection>`'s hash dispatch
        // then expands + scrolls to that row. `faqItemAnchor` is the same lib SSOT the
        // page uses to mint the row anchors, so target and anchor always match.
        faq: (id) => ({ href: `/faqs#${faqItemAnchor(id)}`, targetPlatform: null }),
      },
    }),
    // Per-documentType doc-viewer targets. Doc chips with NO public externalUrl
    // resolve here when their documentType has an entry — the lib emits
    // `getBaseUrl(platform)/<basePath>/<path>` and opens it in a NEW TAB.
    //
    // `markdown` is intentionally OMITTED — this embedder now mounts its OWN
    // `<DocsHubPage>` at /knowledge-base (see app-routes.tsx + pages/knowledge-base.tsx),
    // so markdown chips should soft-navigate IN-APP via react-router instead. With
    // `markdown` absent here, the lib's chip resolver falls through to the surface's
    // `baseRoute` (set on `<EmbeddableChat>` in ask-ai.tsx), producing a relative
    // `<a href="/knowledge-base/<path>">` the registered react-router intercepts.
    //
    // `data_room_doc` is kept cross-domain to company-hub — this embedder doesn't host
    // a data-room viewer, so those chips correctly open in a new tab against the canonical
    // hub URL.
    docPlatformTargets: {
      data_room_doc: { platform: 'company-hub', basePath: 'data-room' },
    },
  }
}

export function buildEndpointsRuntime(): EndpointsRuntime {
  return {
    announcementsUrl: EP.announcements,
    accessCode: { validateUrl: EP.accessValidate, consumeUrl: EP.accessConsume },
    contactUrl: EP.contact,
  }
}

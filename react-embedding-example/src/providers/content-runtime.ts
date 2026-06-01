// ONE factory for both lib runtime contexts. Every endpoint comes from EP, so the
// `/content` base is the single source. Mounted (memoized) in app-providers.tsx.
import type { ChatRuntime, EndpointsRuntime } from '@flamingo-stack/openframe-frontend-core/contexts'
import { buildListUrl, makeComposeContentUrl } from '@flamingo-stack/openframe-frontend-core/utils'
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
    resolvePlaceholderUrl: (title) => EP.ogPlaceholder(title),
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
        roadmap_item: (id) => ({ href: `/roadmap?search=${encodeURIComponent(id)}`, targetPlatform: null }),
        delivery_item: (id) => ({ href: `/delivery?search=${encodeURIComponent(id)}`, targetPlatform: null }),
      },
    }),
    // Per-documentType doc-viewer targets. Doc chips (markdown / data_room_doc) carry no
    // public externalUrl, so the lib resolves each PER ROW to its home platform's public
    // viewer — getBaseUrl(platform)/<basePath>/<path> — in a new tab. A chat surfacing
    // BOTH sources routes each correctly (no single static fallback): OpenFrame docs →
    // flamingo's knowledge hub, data-room docs → company-hub. (Data room isn't an enabled
    // source for OpenFrame today, but wiring it keeps the behavior unified + future-proof.)
    docPlatformTargets: {
      markdown: { platform: 'flamingo', basePath: 'knowledge-base' },
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

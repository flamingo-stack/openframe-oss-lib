// ONE factory for both lib runtime contexts. Every endpoint comes from EP, so the
// `/content` base is the single source. Mounted (memoized) in app-providers.tsx.
import type { ChatRuntime, EndpointsRuntime } from '@flamingo-stack/openframe-frontend-core/contexts'
import { buildListUrl, makeComposeContentUrl } from '@flamingo-stack/openframe-frontend-core/utils'
import { CONTENT_PREFIX } from '../../proxy/content-prefix.mjs'
import { EP, HUB_PUBLIC_ORIGIN } from '../config/endpoints'

// The content types THIS embedder hosts on its own slugged routes (see
// app-routes.tsx). `makeComposeContentUrl` returns a relative in-app href for
// these (soft-navigates) and the canonical hub origin for everything else.
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
    }),
  }
}

export function buildEndpointsRuntime(): EndpointsRuntime {
  return {
    announcementsUrl: EP.announcements,
    accessCode: { validateUrl: EP.accessValidate, consumeUrl: EP.accessConsume },
    contactUrl: EP.contact,
  }
}

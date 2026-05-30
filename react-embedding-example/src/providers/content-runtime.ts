// ONE factory for both lib runtime contexts. Every endpoint comes from EP, so the
// `/content` base is the single source. Mounted (memoized) in app-providers.tsx.
import type { ChatRuntime, EndpointsRuntime } from '@flamingo-stack/openframe-frontend-core/contexts'
import { EP, DEFAULT_SOURCE, HUB_PUBLIC_ORIGIN } from '../config/endpoints'
import { buildListUrl } from '../config/chat-meta'
import { navigateInApp } from './router-nav'
import { resolveContentPath } from '../config/content-routes'

export function buildChatRuntime(): ChatRuntime {
  return {
    endpoints: {
      chatStreamUrl: EP.chatStream,
      approvalToolUrl: EP.approval,
      commandsUrl: EP.commands,
      buildListUrl,
      attachmentUploadUrl: EP.attachmentUpload,
      // Relative is correct HERE: the proxy is same-origin to the SPA, and the lib's
      // embedAuthedFetch (used by uploads + tickets) rejects cross-origin/absolute URLs.
      attachmentViewUrlPrefix: EP.attachmentViewPrefix,
      identityUrl: EP.identity,
      imageProxyUrlPrefix: EP.imageProxy,
    },
    navigation: {
      // 'host' = this app owns routing. The lib calls `navigate` for content/entity-card
      // clicks; we route same-origin paths through react-router (in-app, no reload) and let
      // cross-origin links (canonical hub content) fall back to the browser / new tab.
      mode: 'host',
      navigate: ({ href }) => (href.startsWith('/') ? navigateInApp(href) : false),
    },
    resolvePlaceholderUrl: (title) => EP.ogPlaceholder(title),
    // Comply with the project's canonical buildContentURL shape (PUBLIC_URL_PATHS — see
    // config/content-routes.ts), resolving to THIS app's local routes (single-platform
    // embedder). This is the override point for the per-type "app suffix slug". Unknown
    // types fall back to the canonical hub page.
    composeContentUrl: (type, slug) => {
      const local = resolveContentPath(type, slug)
      return local
        ? { href: local, targetPlatform: null }
        : { href: `${HUB_PUBLIC_ORIGIN}/${type}/${slug}`, targetPlatform: null }
    },
    // localStorage namespacing + doc-search scope; must match the hub's currentPlatform().
    source: DEFAULT_SOURCE,
  }
}

export function buildEndpointsRuntime(): EndpointsRuntime {
  return {
    announcementsUrl: EP.announcements,
    accessCode: { validateUrl: EP.accessValidate, consumeUrl: EP.accessConsume },
    contactUrl: EP.contact,
  }
}

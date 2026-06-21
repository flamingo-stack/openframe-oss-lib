import { useParams } from 'react-router-dom'
import { DocsHubPage } from '@flamingo-stack/openframe-frontend-core/components/docs'
import { RichMarkdownRenderer } from '@flamingo-stack/openframe-frontend-core/components/ui'
import { SECTION_HERO_ICON_CLASS } from '@flamingo-stack/openframe-frontend-core/utils'
import { BookOpen } from 'lucide-react'
import { EP } from '../config/endpoints'
import { DOCS_BASE_ROUTE } from '../config/content'

/**
 * Reference embed of `<DocsHubPage>` — sidebar tree, content area, scroll-spy,
 * and the in-source RAG search bar — over the same `/content` reverse proxy
 * the rest of this app uses.
 *
 * Markdown rendering reuses the lib's own `<RichMarkdownRenderer>` from
 * `components/ui`. The lib already declares `react-markdown` as a regular
 * dependency, so it resolves transitively — embedders don't need to install
 * their own markdown library. The lib renderer also brings its built-in
 * rehype HAST sanitizer (XSS-safe), so a third-party embedder doesn't have
 * to invent a sanitization story per-app. The reddit/twitter/OG endpoints
 * the renderer's satellites call are configured once via
 * `RichMarkdownRuntimeProvider` in `app-providers.tsx`.
 *
 * `chatSource` is a hardcoded literal here as `EMBEDDING_DOCS_HUB.md` §6
 * mandates — NEVER read it from `window.location` or anything user-controllable.
 */
export function KnowledgeBasePage() {
  const params = useParams()
  // react-router's `*` wildcard lands the path-rest in `params['*']`.
  const docPath = (params['*'] ?? '').replace(/^\/+|\/+$/g, '')

  return (
    <DocsHubPage
      sourceId="openframe-docs"
      baseRoute={DOCS_BASE_ROUTE}
      docPath={docPath}
      chatSource="react-embedding-example"
      title="Knowledge Hub"
      titleIcon={<BookOpen className={SECTION_HERO_ICON_CLASS} />}
      subtitle="Comprehensive guides and references for the OpenFrame platform"
      accentDot
      // Proxy-prefix overrides — `structureEndpoint` and `contentEndpoint` are
      // the two endpoints unique to `<DocsHubPage>`. The in-source RAG search
      // bar's endpoint is wired once in `content-runtime.ts` via
      // `ChatRuntime.endpoints.docsSearchUrl` (same injection pattern tickets
      // uses for `findTicketUrl`) — no prop needed here.
      structureEndpoint={EP.docsStructure('openframe-docs')}
      contentEndpoint={EP.docsContent('openframe-docs')}
      documentTypeRenderers={{
        markdown: (content, handlers) => (
          <RichMarkdownRenderer
            content={content.content}
            sectionIds={content.sections}
            onInternalLinkClick={handlers.onInternalLinkClick}
            brokenLinks={content.brokenLinks}
            currentPath={handlers.currentPath}
            // Proxy-prefixed override — the lib's `<RichMarkdownRenderer>`
            // builds its internal link-resolver against this endpoint, hitting
            // /content/api/docs/resolve-link → /api/docs/resolve-link on the
            // hub. Without the override the renderer's default
            // `/api/docs/resolve-link` 404s in the embedded SPA (no Next.js
            // route handler in this app).
            resolveLinkEndpointUrl={EP.resolveLink}
            resolveSource="openframe-docs"
          />
        ),
      }}
    />
  )
}

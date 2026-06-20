import { useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { DocsHubPage } from '@flamingo-stack/openframe-frontend-core/components/docs'
import { PageHeading } from '@flamingo-stack/openframe-frontend-core/components'
import { EP } from '../config/endpoints'

/**
 * Reference embed of `<DocsHubPage>` — sidebar tree, content area, scroll-spy,
 * and the in-source RAG search bar — over the same `/content` reverse proxy
 * the rest of this app uses.
 *
 * What this surface proves:
 *  - the lib component mounts in a third-party React app with NO Next.js,
 *  - all four API endpoints (structure / content / search / chat) flow through
 *    the proxy prefix via runtime + prop overrides — zero hardcoded `/api/*`,
 *  - `documentTypeRenderers.markdown` is the only thing this embedder has to
 *    write; pdf / google_sheet / figma / file all default to lib renderers.
 *
 * `chatSource` is a hardcoded literal here as the embedding tutorial mandates —
 * NEVER read it from `window.location` or any user-controllable source. The
 * value identifies this embedder to the chat backend for RAG-scope filtering.
 */
export function KnowledgeBasePage() {
  const params = useParams()
  // react-router's `*` wildcard lands the full path-rest in `params['*']`.
  const docPath = (params['*'] ?? '').replace(/^\/+|\/+$/g, '')

  return (
    <DocsHubPage
      sourceId="openframe-docs"
      baseRoute="/knowledge-base"
      docPath={docPath}
      chatSource="react-embedding-example"
      title={<PageHeading>Knowledge Hub</PageHeading>}
      // Proxy-prefix overrides — all three docs endpoints flow through the
      // same `/content/api/*` reverse proxy. (`searchEndpoint` could also be
      // set once on `ChatRuntime.endpoints.docsSearchUrl` instead; this app
      // does that in `content-runtime.ts` so the prop here is optional.)
      structureEndpoint={EP.docsStructure('openframe-docs')}
      contentEndpoint={EP.docsContent('openframe-docs')}
      documentTypeRenderers={{
        // Embedders pick their own markdown library + sanitization — the lib
        // intentionally ships no default markdown renderer (no marked peer
        // dep, no XSS surface in the lib).
        markdown: (content) => (
          <div className="prose prose-invert max-w-none">
            <ReactMarkdown>{content.content}</ReactMarkdown>
          </div>
        ),
      }}
    />
  )
}

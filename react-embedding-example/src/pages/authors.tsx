import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArticleAuthorByline } from '@flamingo-stack/openframe-frontend-core/components'
import { RelatedContentSection } from '@flamingo-stack/openframe-frontend-core/components/related-content'
import { useChatRuntime } from '@flamingo-stack/openframe-frontend-core/contexts'
import { extractItems } from '@flamingo-stack/openframe-frontend-core/utils'
import type { EntityAuthor } from '@flamingo-stack/openframe-frontend-core/types'
import { CONTENT_PREFIX } from '../../proxy/content-prefix.mjs'
import { EP } from '../config/endpoints'
import { PageError } from '../components/page-state'

/**
 * Authors demo — the two author surfaces an embedder can host:
 *
 *   1. `<ArticleAuthorByline>` — the end-of-article author-description card
 *      (avatar + linked name + job title + BIO). Fully embeddable: Link/Image
 *      render through the embed-shims, the avatar proxies through the ambient
 *      `ChatRuntime.endpoints.imageProxyUrlPrefix` (`/content/api/image-proxy`
 *      here), and `fallbackBio` is plain copy (no hub config import).
 *
 *   2. `<RelatedContentSection authorId=…>` — AUTHOR mode: self-fetches ALL
 *      published content authored by the profile from
 *      `{apiBaseUrl}/api/related-content?authorId=…`, grouped per type with
 *      per-group pagination. Group rows resolve through the same per-type list
 *      endpoints the chat cards use (`buildListUrl`, based at `/content`).
 *
 * Author DISCOVERY (this page's picker) reuses the hydrated `author` payload
 * the hub attaches to its public list rows (`/content/api/releases` →
 * `hydrateAuthor`): id (profile UUID, feeds `authorId`), full_name,
 * avatar_url, job_title, `about` (the bio) and the publicly-gated author-page
 * `slug` — there is no dedicated public authors-list endpoint today.
 *
 * The byline's name link composes through the SAME unified content-URL seam
 * as every other content type — `runtime.composeContentUrl({ type: 'author' })`
 * (the lib's `DEFAULT_CONTENT_SUFFIXES.author = 'authors'`): not in this
 * app's `hostedTypes`, so it resolves to the hub origin's `/authors/<slug>`
 * page and opens out.
 */

/** Discover authors from the hydrated release list payload (50 newest). */
function useDiscoveredAuthors() {
  return useQuery({
    queryKey: ['authors-from-releases'],
    queryFn: async (): Promise<EntityAuthor[]> => {
      const res = await fetch(`${EP.productReleases}?limit=50`)
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      const rows = extractItems(await res.json()) as Array<{ author?: EntityAuthor }>
      const byId = new Map<string, EntityAuthor>()
      for (const row of rows) {
        const a = row.author
        if (a?.id && a.full_name && !byId.has(a.id)) byId.set(a.id, a)
      }
      return [...byId.values()]
    },
    // House useQuery posture: no stale cache, refetch on mount/focus —
    // guarantees fresh data + correct loading states.
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })
}

export function AuthorsPage() {
  const { data: authors, error, isLoading } = useDiscoveredAuthors()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const runtime = useChatRuntime()

  // Memoized — a fresh object every render would re-render every card.
  const extras = useMemo(
    () => ({ buildOgPlaceholderUrl: (title: string) => EP.ogPlaceholder(title) }),
    [],
  )

  if (error) return <PageError title="Couldn't load authors" detail={(error as Error).message} />
  if (isLoading) return <div className="p-10 text-sm text-ods-text-secondary">Loading authors…</div>
  if (!authors || authors.length === 0) {
    return (
      <PageError
        title="No authors found"
        detail="The hub's /content/api/releases rows carried no hydrated author payloads."
      />
    )
  }

  const selected = authors.find((a) => a.id === selectedId) ?? authors[0]

  // Unified content-URL seam — same resolver every content type uses. The
  // 'author' type is not in this app's hostedTypes, so this composes the hub
  // origin's /authors/<slug> URL (DEFAULT_CONTENT_SUFFIXES.author). The slug
  // is only present when the hub's public-author gate passes; absent ⇒ plain
  // text name.
  const authorHref = selected.slug
    ? runtime?.composeContentUrl?.({ type: 'author', identifier: selected.slug })?.href
    : undefined

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-ods-text-primary">Authors</h1>
        <p className="mt-2 max-w-3xl text-sm text-ods-text-secondary">
          The embeddable author byline (description card) + the author-scoped related-content
          rail, both fed through <code>/content</code>. Pick an author discovered from the
          hub's release payloads:
        </p>
      </div>

      {/* Author picker */}
      <div className="flex flex-wrap gap-2">
        {authors.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setSelectedId(a.id ?? null)}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              a.id === selected.id
                ? 'border-ods-text-secondary bg-ods-bg text-ods-text-primary'
                : 'border-ods-border bg-ods-card text-ods-text-secondary hover:text-ods-text-primary'
            }`}
          >
            {a.full_name}
          </button>
        ))}
      </div>

      {/* 1. The byline card — bio from the hydrated `about`, name linking out
            to the hub's author page via the unified composeContentUrl seam. */}
      <ArticleAuthorByline
        author={selected.full_name}
        avatar={selected.avatar_url}
        jobTitle={selected.job_title}
        bio={selected.about}
        href={authorHref}
        fallbackBio="Contributing author."
      />

      {/* 2. AUTHOR-mode rail — everything this profile authored, grouped per
            type. Suggestion + per-group list fetches both ride apiBaseUrl
            (= /content); card hrefs use the refs' hub URLs (cross-origin ⇒
            new tab via the default link provider). */}
      <RelatedContentSection
        key={selected.id}
        authorId={selected.id}
        title={`Everything by ${selected.full_name}`}
        columns={3}
        apiBaseUrl={CONTENT_PREFIX}
        extras={extras}
      />
    </div>
  )
}

/**
 * Map RAG `/api/docs/search` wire results into the `<DocSearchBar>`
 * dropdown's row shape, collapsing entity-table rows into grouped
 * results so the dropdown lists ONE "Cap Table (12 records)" row
 * instead of 12 individual rows.
 *
 * Pure transform — no telemetry, no navigation, no React deps. Lifted
 * from the hub's `hooks/use-docs.ts:mapDocSearchResults` (the hub's
 * `traceCompose` call was hub-only telemetry and is intentionally
 * dropped — callers that want logging can wrap this helper).
 */

import type { SearchResult } from '../../ui/search-input'
import type { DocSearchResult } from './types'

/** Source repos that should be collapsed into grouped results in the search bar.
 *  Only financial tables (all rows link to the same admin page).
 *  Content tables (blog, webinar, podcast, etc.) stay individual since each has a unique URL. */
const SEARCH_GROUP_REPOS = new Set([
  'financial-cap-table',
  'financial-kpis',
  'financial-pnl',
  'financial-balance-sheet',
  'financial-cash-flow',
])

const ENTITY_LABELS: Record<string, string> = {
  'financial-cap-table': 'Cap Table',
  'financial-kpis': 'Financial KPIs',
  'financial-pnl': 'Profit & Loss',
  'financial-balance-sheet': 'Balance Sheets',
  'financial-cash-flow': 'Cash Flow',
  'blog-posts': 'Blog Posts',
  'product-releases': 'Product Releases',
  'case-studies': 'Case Studies',
  webinars: 'Webinars',
  events: 'Events',
  podcasts: 'Podcasts',
}

export function mapDocSearchResults(docs: DocSearchResult[]): SearchResult[] {
  const entityGroups = new Map<string, DocSearchResult[]>()
  // Track insertion order — groups appear where the FIRST row of that
  // repo appeared in the response.
  const order: Array<
    { type: 'entity'; repo: string } | { type: 'doc'; doc: DocSearchResult }
  > = []
  const seenRepos = new Set<string>()

  for (const doc of docs) {
    if (doc.sourceRepo && SEARCH_GROUP_REPOS.has(doc.sourceRepo)) {
      const group = entityGroups.get(doc.sourceRepo) || []
      group.push(doc)
      entityGroups.set(doc.sourceRepo, group)
      if (!seenRepos.has(doc.sourceRepo)) {
        seenRepos.add(doc.sourceRepo)
        order.push({ type: 'entity', repo: doc.sourceRepo })
      }
    } else {
      order.push({ type: 'doc', doc })
    }
  }

  const results: SearchResult[] = []
  for (const entry of order) {
    if (entry.type === 'entity') {
      const rows = entityGroups.get(entry.repo)!
      const label = ENTITY_LABELS[entry.repo] || entry.repo
      results.push({
        id: `group-${entry.repo}`,
        title: `${label} (${rows.length} ${rows.length === 1 ? 'record' : 'records'})`,
        path: rows[0].path,
        type: 'file',
        metadata: {
          documentType: rows[0].documentType,
          externalUrl: rows[0].externalUrl,
          sourceRepo: entry.repo,
          id: rows[0].entityId,
          isGroup: true,
          items: rows.map((r) => ({
            name: r.name,
            externalUrl: r.externalUrl,
            id: r.entityId,
            sourceRepo: r.sourceRepo,
            documentType: r.documentType,
          })),
        },
      })
    } else {
      const doc = entry.doc
      const isNonMarkdown = doc.documentType && doc.documentType !== 'markdown'
      results.push({
        id: doc.path,
        title: doc.name,
        description: isNonMarkdown ? doc.name : doc.snippet,
        path: doc.path,
        type: doc.type,
        metadata: {
          matchType: doc.matchType,
          ...(doc.documentType ? { documentType: doc.documentType } : {}),
          ...(doc.externalUrl ? { externalUrl: doc.externalUrl } : {}),
          ...(doc.targetPlatform != null
            ? { targetPlatform: doc.targetPlatform }
            : {}),
          ...(doc.sourceRepo ? { sourceRepo: doc.sourceRepo } : {}),
          ...(doc.entityId ? { id: doc.entityId } : {}),
        },
      })
    }
  }

  return results
}

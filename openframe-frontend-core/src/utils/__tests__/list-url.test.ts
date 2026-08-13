import { describe, expect, it } from 'vitest'
import { buildListUrl, canonicalContentRefType } from '../list-url'

/**
 * Byte-parity gate for the shared `buildListUrl`.
 *
 * `BASELINE` is the FROZEN output of each hub RAG mapper's `listApi(['a','b'])`
 * captured BEFORE the 12 mappers were switched to delegate here (verbatim from
 * `lib/config/rag-mappers/*.ts` in multi-platform-hub). `buildListUrl` MUST
 * reproduce each string exactly — any drift in a path or query param fails
 * here, which is the whole point: the hub mappers delegate to this builder, so
 * this test is the contract that keeps the hub's chat-card fetch URLs identical
 * across the migration. (The hub side asserts the same baseline against its own
 * `entity-list-api.buildListUrl` + `buildListBasePath`.)
 */
const BASELINE: Record<string, string> = {
  roadmap_item: '/api/roadmap?task_ids=a,b',
  delivery_item: '/api/delivery?task_ids=a,b',
  internal_task: '/api/internal-tasks?task_ids=a,b',
  blog_post: '/api/blog/posts?ids=a,b&pageSize=2',
  webinar: '/api/programs/webinars?ids=a,b&limit=2&filter=all',
  podcast: '/api/programs/podcasts?ids=a,b&limit=2&filter=all',
  event: '/api/programs/events?ids=a,b&limit=2&filter=all',
  onboarding_guide: '/api/onboarding-guides?ids=a,b&limit=2',
  case_study: '/api/case-studies?ids=a,b&limit=2',
  product_release: '/api/releases?ids=a,b&limit=2',
  customer_interview: '/api/customer-interviews?ids=a,b&limit=2',
  investor_update: '/api/investor-updates?ids=a,b&limit=2',
  // Not migration baselines — added 2026-08 with the everything-fetches card
  // unification; frozen here the same way so the hub config delegations
  // can't drift. One route per OBJECT: self tickets ride the
  // session-scoped `/api/tickets`; internal/public github variants share
  // their object's route (the route resolves the bound variant).
  hubspot_ticket_self: '/api/tickets?ids=a,b',
  github_commit: '/api/github/commits?ids=a,b',
  github_commit_public: '/api/github/commits?ids=a,b',
  github_pull_request: '/api/github/pull-requests?ids=a,b',
  github_pull_request_public: '/api/github/pull-requests?ids=a,b',
  github_pr_review: '/api/github/reviews?ids=a,b',
  github_pr_review_public: '/api/github/reviews?ids=a,b',
  slack_message: '/api/slack-community/messages?ids=a,b',
  hubspot_ticket: '/api/tickets/internal?ids=a,b',
  hubspot_ticket_anon: '/api/tickets/known-issues?ids=a,b',
  data_room_doc: '/api/data-room/documents?ids=a,b',
  markdown: '/api/docs/pages?ids=a,b',
  financial_kpi: '/api/financials/kpis?ids=a,b',
  cap_table: '/api/financials/cap-table?ids=a,b',
  profit_loss: '/api/financials/profit-loss?ids=a,b',
  balance_sheet: '/api/financials/balance-sheet?ids=a,b',
  cash_flow: '/api/financials/cash-flow?ids=a,b',
}

describe('buildListUrl — byte parity with the hub mappers', () => {
  it.each(Object.entries(BASELINE))('%s → exact prior listApi output', (type, expected) => {
    expect(buildListUrl(type, ['a', 'b'])).toBe(expected)
  })

  it('canonicalContentRefType: aliases resolve, prototype keys do not', () => {
    expect(canonicalContentRefType('blog_post_existing')).toBe('blog_post')
    expect(canonicalContentRefType('roadmap_item')).toBe('roadmap_item')
    // A bare `ALIASES[key]` read returned `Object` here, which downstream
    // interpolated into a URL path.
    expect(canonicalContentRefType('constructor')).toBe('constructor')
    expect(canonicalContentRefType('__proto__')).toBe('__proto__')
    expect(canonicalContentRefType('toString')).toBe('toString')
  })

  it('un-aliases blog_post_existing → blog_post (mirrors hub LEGACY_TYPE_ALIASES)', () => {
    expect(buildListUrl('blog_post_existing', ['a', 'b'])).toBe(BASELINE.blog_post)
  })

  it('builds marketing_campaign via the literal admin case', () => {
    expect(buildListUrl('marketing_campaign', ['a', 'b'])).toBe(
      '/api/admin/marketing/campaigns?ids=a,b&pageSize=2',
    )
  })
})

describe('buildListUrl — base prefix (embedder reverse-proxy)', () => {
  it('prepends a non-empty base to every builder', () => {
    expect(buildListUrl('roadmap_item', ['a', 'b'], '/content')).toBe(
      '/content/api/roadmap?task_ids=a,b',
    )
    expect(buildListUrl('blog_post', ['a', 'b'], '/content')).toBe(
      '/content/api/blog/posts?ids=a,b&pageSize=2',
    )
    expect(buildListUrl('webinar', ['a', 'b'], '/content')).toBe(
      '/content/api/programs/webinars?ids=a,b&limit=2&filter=all',
    )
    expect(buildListUrl('marketing_campaign', ['a', 'b'], '/content')).toBe(
      '/content/api/admin/marketing/campaigns?ids=a,b&pageSize=2',
    )
  })

  it('default base is empty (hub-relative)', () => {
    expect(buildListUrl('product_release', ['a', 'b'])).toBe(
      buildListUrl('product_release', ['a', 'b'], ''),
    )
  })
})

describe('buildListUrl — pageSize / limit track ids.length', () => {
  it('single id', () => {
    expect(buildListUrl('blog_post', ['x'])).toBe('/api/blog/posts?ids=x&pageSize=1')
    expect(buildListUrl('case_study', ['x'])).toBe('/api/case-studies?ids=x&limit=1')
  })
  it('three ids', () => {
    expect(buildListUrl('onboarding_guide', ['a', 'b', 'c'])).toBe(
      '/api/onboarding-guides?ids=a,b,c&limit=3',
    )
  })
})

// Mirrors the hub's `entity-list-api.buildListBasePath` (probe an id, strip the
// query) — that fn is unchanged hub code, so proving the bare path each builder
// emits is stable here transitively proves `buildListBasePath` is unchanged.
describe('buildListUrl — base-path derivation (covers hub buildListBasePath)', () => {
  const BASE_PATHS: Record<string, string> = {
    roadmap_item: '/api/roadmap',
    delivery_item: '/api/delivery',
    internal_task: '/api/internal-tasks',
    blog_post: '/api/blog/posts',
    webinar: '/api/programs/webinars',
    podcast: '/api/programs/podcasts',
    event: '/api/programs/events',
    onboarding_guide: '/api/onboarding-guides',
    case_study: '/api/case-studies',
    product_release: '/api/releases',
    customer_interview: '/api/customer-interviews',
    investor_update: '/api/investor-updates',
    marketing_campaign: '/api/admin/marketing/campaigns',
    hubspot_ticket_self: '/api/tickets',
  }
  it.each(Object.entries(BASE_PATHS))('%s → %s', (type, base) => {
    const url = buildListUrl(type, ['__probe__'])
    expect(url).not.toBeNull()
    const q = url!.indexOf('?')
    expect(q < 0 ? url : url!.slice(0, q)).toBe(base)
  })
})

describe('buildListUrl — null (no list endpoint)', () => {
  it('empty ids → null', () => {
    expect(buildListUrl('roadmap_item', [])).toBeNull()
    expect(buildListUrl('marketing_campaign', [])).toBeNull()
  })

  // Only the two genuinely un-fetchable types are ABSENT keys — their
  // absence IS the null. `deleted_data` is a tombstone for a row that no
  // longer exists; `video` ids are body-embed content hashes with no
  // backing table row. Guards against accidentally adding a builder.
  it.each([
    'deleted_data',
    'video',
    'unknown_type',
  ])('%s → null', (type) => {
    expect(buildListUrl(type, ['a', 'b'])).toBeNull()
  })

  it('prototype keys do not dispatch (hasOwnProperty guard)', () => {
    expect(buildListUrl('constructor', ['a', 'b'])).toBeNull()
    expect(buildListUrl('__proto__', ['a', 'b'])).toBeNull()
    expect(buildListUrl('hasOwnProperty', ['a', 'b'])).toBeNull()
  })
})

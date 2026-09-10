/**
 * Shared list-API URL builder — the single un-replicable piece of the
 * chat entity-card fetch path.
 *
 * ## Why this exists
 *
 * A fetch-mode entity card (`dispatch.tsx` → `useChatCardItem`) expands a
 * compact `[card://<type>:<id>]` marker by fetching the type's public list
 * endpoint with an `?ids=` (or `?task_ids=`) filter and matching the row
 * back by id. The per-type URL SHAPE is non-obvious — `task_ids` for the
 * ClickUp-backed types, `pageSize` for blog, `&limit=N&filter=all` for the
 * programs trio, a distinct `/customer-interviews` path, etc. — and lives in
 * the hub's 12 RAG mapper closures (`lib/config/rag-mappers/*.ts`). An
 * embedder can't reverse-engineer those shapes, so a wrong/missing builder
 * resolves a null URL ⇒ `enabled:false` ⇒ the card never fetches and renders
 * nothing.
 *
 * This builder is the ONE source for those shapes. The hub's 12 mappers
 * delegate their `listApi` here (a byte-parity test guards the migration),
 * and embedders wire it once:
 *
 *   endpoints.buildListUrl = (type, ids) => buildListUrl(type, ids, '/content')
 *
 * `base=''` (default) yields the hub-relative `/api/...`; `base='/content'`
 * (or any reverse-proxy prefix) yields `/content/api/...`.
 *
 * Pure + server-safe (no React, no browser APIs) so the hub's server-side
 * mappers can import it from `@flamingo-stack/openframe-frontend-core/utils`.
 */

/**
 * Legacy ContentRef aliases that predate the RAG `documentType`
 * unification — direct lib/embedder callers (e.g. the chat dispatcher's
 * `endpoints.buildListUrl`) still emit `blog_post_existing`. Mirrors the
 * hub's own `LEGACY_TYPE_ALIASES` (`lib/utils/entity-list-api.ts`); both
 * entry points un-alias to the canonical `documentType` before lookup.
 */
const ALIASES: Record<string, string> = { blog_post_existing: 'blog_post' };

/** Resolve a ContentRef rail-vocab type to its canonical `documentType`
 *  (registry vocabulary) — `blog_post_existing` → `blog_post`, everything
 *  else passes through. Exported so consumers comparing rail group keys to
 *  registry entityTypes (e.g. the related-content rail's same-type-first
 *  ordering) share THIS alias map instead of re-declaring it. */
export function canonicalContentRefType(contentRefType: string): string {
  // `hasOwnProperty` guard, same as `buildListUrl` below: a bare index read
  // resolves prototype keys, so `canonicalContentRefType('constructor')`
  // returned `Object` itself — which then got interpolated into a URL path.
  return Object.prototype.hasOwnProperty.call(ALIASES, contentRefType) ? ALIASES[contentRefType] : contentRefType;
}

/**
 * One builder per fetch-mode `contentRefType`, keyed by the canonical
 * `documentType`. Each body is copied VERBATIM from the matching hub
 * mapper's `listApi` (raw, unencoded `join(',')`; exact param names) —
 * the byte-parity test (`__tests__/list-url.test.ts`) fails if any drifts.
 *
 * An ABSENT key ⇒ `buildListUrl` returns null (no-fetch). Only two types
 * are intentionally absent — `deleted_data` (tombstone of a deleted row;
 * nothing exists to fetch) and `video` (body-embed content-hash ids with
 * no backing table row). Every other card type resolves here: content
 * types to their public list APIs, the rest to their per-object
 * card-hydration routes (see `ENTITY_CARD_ROUTES` below).
 * `marketing_campaign` is handled as a literal case in `buildListUrl`
 * (see there).
 */
const BUILDERS: Record<string, (ids: string[], base: string) => string> = {
  roadmap_item: (ids, b) => `${b}/api/roadmap?task_ids=${ids.join(',')}`,
  delivery_item: (ids, b) => `${b}/api/delivery?task_ids=${ids.join(',')}`,
  internal_task: (ids, b) => `${b}/api/internal-tasks?task_ids=${ids.join(',')}`,
  blog_post: (ids, b) => `${b}/api/blog/posts?ids=${ids.join(',')}&pageSize=${ids.length}`,
  webinar: (ids, b) => `${b}/api/programs/webinars?ids=${ids.join(',')}&limit=${ids.length}&filter=all`,
  podcast: (ids, b) => `${b}/api/programs/podcasts?ids=${ids.join(',')}&limit=${ids.length}&filter=all`,
  event: (ids, b) => `${b}/api/programs/events?ids=${ids.join(',')}&limit=${ids.length}&filter=all`,
  onboarding_guide: (ids, b) => `${b}/api/onboarding-guides?ids=${ids.join(',')}&limit=${ids.length}`,
  case_study: (ids, b) => `${b}/api/case-studies?ids=${ids.join(',')}&limit=${ids.length}`,
  product_release: (ids, b) => `${b}/api/releases?ids=${ids.join(',')}&limit=${ids.length}`,
  customer_interview: (ids, b) => `${b}/api/customer-interviews?ids=${ids.join(',')}&limit=${ids.length}`,
  investor_update: (ids, b) => `${b}/api/investor-updates?ids=${ids.join(',')}&limit=${ids.length}`,
  faq: (ids, b) => `${b}/api/faqs?ids=${ids.join(',')}&limit=${ids.length}`,
  // Self-scoped: the endpoint filters by the SESSION user's email server-side
  // (`selfScopeFilter`), so foreign ids simply return no row — safe to expose
  // through the same builder path as the public types.
  hubspot_ticket_self: (ids, b) => `${b}/api/tickets?ids=${ids.join(',')}`,
  // Per-OBJECT card-hydration routes for the types with no pre-existing
  // public list API. THIS map is the only place these URL shapes exist —
  // the hub's mappers/configs delegate here (`listApi: (ids) =>
  // buildListUrl('<type>', ids)`), same as every entry above. The
  // internal/public GitHub variants share their object's route; the
  // route serves whichever variant is bound to the calling source.
  github_commit: (ids, b) => `${b}/api/github/commits?ids=${ids.join(',')}`,
  github_commit_public: (ids, b) => `${b}/api/github/commits?ids=${ids.join(',')}`,
  github_pull_request: (ids, b) => `${b}/api/github/pull-requests?ids=${ids.join(',')}`,
  github_pull_request_public: (ids, b) => `${b}/api/github/pull-requests?ids=${ids.join(',')}`,
  github_pr_review: (ids, b) => `${b}/api/github/reviews?ids=${ids.join(',')}`,
  github_pr_review_public: (ids, b) => `${b}/api/github/reviews?ids=${ids.join(',')}`,
  slack_message: (ids, b) => `${b}/api/slack-community/messages?ids=${ids.join(',')}`,
  hubspot_ticket: (ids, b) => `${b}/api/tickets/internal?ids=${ids.join(',')}`,
  hubspot_ticket_anon: (ids, b) => `${b}/api/tickets/known-issues?ids=${ids.join(',')}`,
  data_room_doc: (ids, b) => `${b}/api/data-room/documents?ids=${ids.join(',')}`,
  markdown: (ids, b) => `${b}/api/docs/pages?ids=${ids.join(',')}`,
  financial_kpi: (ids, b) => `${b}/api/financials/kpis?ids=${ids.join(',')}`,
  cap_table: (ids, b) => `${b}/api/financials/cap-table?ids=${ids.join(',')}`,
  profit_loss: (ids, b) => `${b}/api/financials/profit-loss?ids=${ids.join(',')}`,
  balance_sheet: (ids, b) => `${b}/api/financials/balance-sheet?ids=${ids.join(',')}`,
  cash_flow: (ids, b) => `${b}/api/financials/cash-flow?ids=${ids.join(',')}`,
  // People-hub employee feeds — their EXISTING list APIs (`?ids=`, also feeding
  // the related-content rail + author page), entry-shaped rows.
  what_i_shipped: (ids, b) => `${b}/api/what-i-shipped?ids=${ids.join(',')}&limit=${ids.length}`,
  how_i_work: (ids, b) => `${b}/api/how-i-work?ids=${ids.join(',')}&limit=${ids.length}`,
  // Product-hub internal objects — per-object card-hydration routes
  // (ChatRef-shaped items, `handleEntityCardList`), like github / slack.
  design_doc: (ids, b) => `${b}/api/design-docs?ids=${ids.join(',')}`,
  openframe_tenant: (ids, b) => `${b}/api/openframe-tenants?ids=${ids.join(',')}`,
};

/**
 * Build a list-API URL that returns full rows for the given ids, or `null`
 * when the type has no list endpoint (the caller skips fetching rather than
 * fabricating a URL).
 *
 *   buildListUrl('roadmap_item', ['a','b'])             → '/api/roadmap?task_ids=a,b'
 *   buildListUrl('blog_post_existing', ['a','b'])       → '/api/blog/posts?ids=a,b&pageSize=2'  (alias)
 *   buildListUrl('roadmap_item', ['a','b'], '/content') → '/content/api/roadmap?task_ids=a,b'
 *   buildListUrl('github_pr', ['a'])                    → null  (absent key)
 *
 * `marketing_campaign` (admin-only, non-RAG) is a LITERAL case, NOT a
 * `BUILDERS` entry — a static branch keeps CodeQL able to prove no
 * user-controlled dynamic dispatch reaches the admin endpoint; embedders
 * can't hit `/api/admin` through their proxy anyway.
 */
export function buildListUrl(contentRefType: string, ids: string[], base = ''): string | null {
  if (ids.length === 0) return null;
  const key = ALIASES[contentRefType] ?? contentRefType;
  if (key === 'marketing_campaign') {
    // Keep this URL in sync with the hub's `entity-list-api.ts` buildNonRagListUrl
    // — an intentional dual literal (a static branch in each) so CodeQL can prove
    // no user-controlled dynamic dispatch reaches `/api/admin`.
    return `${base}/api/admin/marketing/campaigns?ids=${ids.join(',')}&pageSize=${ids.length}`;
  }
  // `hasOwnProperty` guard so a prototype key (`constructor`, `__proto__`)
  // can't dispatch to a non-builder — absent key ⇒ null.
  const fn = Object.prototype.hasOwnProperty.call(BUILDERS, key) ? BUILDERS[key] : undefined;
  return fn ? fn(ids, base) : null;
}

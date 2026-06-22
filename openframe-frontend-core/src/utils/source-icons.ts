/**
 * Per-source icon-name + label lookup. Keyed by `RagTableConfig.id` (the same
 * id used in `chat_source_rag_tables.rag_table_id` and on each
 * `ChatRef.sourceRepo`).
 *
 * Server-safe — lives in `src/utils/` (no `'use client'` banner) so
 * hub server-side rag-mappers + chat route handlers can call
 * `getSourceLabel()` / `getSourceIconName()` directly. The client-side
 * chat barrel re-exports from here for ergonomic client imports.
 *
 * Used by SOURCE-LEVEL chip surfaces:
 *   - The chip strip below an assistant message.
 *   - The tracking-row source glyph on inline entity cards.
 *
 * Why a small map here instead of a column on RAG_TABLE_CONFIGS:
 *   - The icon NAME is a small string; the resolver (icon-name → React
 *     component) lives in `src/components/chat/utils/icon-registry.ts`
 *     where it can stay client-only. Server-side consumers stay
 *     icon-component-free.
 *   - The mapping is intrinsic to the TABLE, not per-platform — same
 *     entry serves every (platform, source) binding.
 *
 * Per-table admin-UI bucket id (`SOURCE_CATEGORIES_BY_TABLE`) stays
 * hub-side because it depends on the hub's `RagSourceCategoryId` enum.
 */

/** Map RagTableConfig.id → icon_name (resolvable via `getIconComponent`). */
export const SOURCE_ICON_NAMES: Record<string, string> = {
  // Doc tables
  'openframe-docs':              'openframe',
  'data-room-docs':              'shield',

  // CMS / programs
  'blog-posts':                  'newspaper',
  'product-releases':            'rocket',
  'case-studies':                'briefcase',
  'onboarding-guides':           'graduation-cap',
  webinars:                      'video',
  events:                        'calendar',
  podcasts:                      'headphones',
  'customer-interviews':         'users',

  // Financials
  'investor-updates':            'mail',
  'financial-kpis':              'activity',
  'financial-cap-table':         'table',
  'financial-pnl':               'trending-up',
  'financial-balance-sheet':     'dollar-sign',
  'financial-cash-flow':         'banknote',

  // ClickUp
  'clickup-roadmap':             'clickup',
  'clickup-delivery':            'clickup',
  'clickup-tasks-internal':      'clickup',

  // GitHub
  'github-commits':              'github',
  'github-pull-requests':        'github',
  'github-pr-reviews':           'github',
  'github-commits-public':       'github',
  'github-pull-requests-public': 'github',
  'github-pr-reviews-public':    'github',

  // HubSpot
  'hubspot-tickets':             'hubspot',
  'hubspot-tickets-anon':        'hubspot',
  'hubspot-tickets-self':        'hubspot',

  // Communications
  'slack-messages':              'slack',
}

/** Lookup an icon name by RagTableConfig.id. Returns undefined when
 *  unknown so callers can decide whether to fall back to documentType
 *  or to the generic FileText glyph in the icon registry. */
export function getSourceIconName(tableId: string | null | undefined): string | undefined {
  if (!tableId) return undefined
  return SOURCE_ICON_NAMES[tableId]
}

/**
 * Per-table display LABEL — used by SERVER-SIDE chip-strip rendering
 * (the row's "Customer Interviews (8 records)" chip below an assistant
 * message).
 *
 * The chip GRID + autocomplete DROPDOWN read their command label
 * from the DB (per-source `chat_admin_slash_commands.label`) — those
 * surfaces can carry per-source labels (e.g. "OpenFrame Commits" vs
 * "GitHub Commits" for the same table). This map is the TABLE-LEVEL
 * label used by sub-message chips where a SINGLE label per table is
 * sufficient regardless of which source's chat is rendering.
 */
export const SOURCE_LABELS_BY_TABLE: Record<string, string> = {
  // Doc tables
  'openframe-docs':              'OpenFrame Docs',
  'data-room-docs':              'Data Room',

  // CMS / programs
  'blog-posts':                  'Blog Posts',
  'product-releases':            'Product Releases',
  'case-studies':                'Case Studies',
  'onboarding-guides':           'Onboarding Guides',
  webinars:                      'Webinars',
  events:                        'Events',
  podcasts:                      'Podcasts',
  'customer-interviews':         'Customer Interviews',

  // Financials
  'investor-updates':            'Investor Updates',
  'financial-kpis':              'Financial KPIs',
  'financial-cap-table':         'Cap Table',
  'financial-pnl':               'Profit & Loss',
  'financial-balance-sheet':     'Balance Sheet',
  'financial-cash-flow':         'Cash Flow',

  // ClickUp
  'clickup-roadmap':             'ClickUp Roadmap',
  'clickup-delivery':            'ClickUp Delivery',
  'clickup-tasks-internal':      'ClickUp Tasks',

  // GitHub
  'github-commits':              'GitHub Commits',
  'github-pull-requests':        'GitHub Pull Requests',
  'github-pr-reviews':           'GitHub PR Reviews',
  'github-commits-public':       'OpenFrame Commits',
  'github-pull-requests-public': 'OpenFrame Pull Requests',
  'github-pr-reviews-public':    'OpenFrame PR Reviews',

  // HubSpot
  'hubspot-tickets':             'HubSpot Tickets',
  // Anon + self share the "Tickets" root so the chip vocabulary is
  // uniform across logged-out (everyone's resolved support tickets,
  // anonymized → "Tickets") and logged-in (user-scoped → "My Tickets")
  // surfaces. The full-PII `hubspot-tickets` entry above is product-hub
  // internal only (admin view), kept as "HubSpot Tickets" to flag the
  // distinct scope.
  'hubspot-tickets-anon':        'Tickets',
  'hubspot-tickets-self':        'My Tickets',

  // Communications
  'slack-messages':              'OpenMSP Community',
}

/** Lookup a human-readable label by RagTableConfig.id. Falls back
 *  to the raw id (chip text becomes the table slug — visible bug
 *  that prompts an entry to land in `SOURCE_LABELS_BY_TABLE`). */
export function getSourceLabel(tableId: string): string {
  return SOURCE_LABELS_BY_TABLE[tableId] ?? tableId
}

/**
 * Default `documentType → RagTableConfig.id` reverse map.
 *
 * Mirrors the canonical lookup the hub registers via
 * `lib/config/rag-table-config.ts:tableIdForDocumentType()` — same vocabulary
 * the LLM emits inside `[card://<type>:<id>]` markers, same tableIds the
 * retrieval layer routes by, and same set of keys covered by
 * `SOURCE_ICON_NAMES` / `SOURCE_LABELS_BY_TABLE` above.
 *
 * Server-safe (no `'use client'` banner), keyed by string for forward
 * compatibility — adding a new RAG table is a single-line edit here so
 * lib-based embedders pick it up without re-publishing.
 *
 * Embedders that need a CUSTOM mapping (e.g. polymorphic types whose
 * tableId depends on per-tenant config) still pass their own
 * `tableIdForDocumentType` callback to `useEmbeddedChat`; this default
 * only applies when no callback is supplied.
 *
 * Inverse mapping audited 2026-05-24 against the hub registry — every
 * entry in `RAG_TABLE_CONFIGS` with a `documentType` is represented.
 */
export const DEFAULT_DOCUMENT_TYPE_TO_TABLE_ID: Record<string, string> = {
  // Doc tables
  markdown:                       'openframe-docs',
  data_room_doc:                  'data-room-docs',

  // CMS / programs
  blog_post:                      'blog-posts',
  product_release:                'product-releases',
  case_study:                     'case-studies',
  onboarding_guide:               'onboarding-guides',
  webinar:                        'webinars',
  event:                          'events',
  podcast:                        'podcasts',
  customer_interview:             'customer-interviews',

  // Financials
  investor_update:                'investor-updates',
  financial_kpi:                  'financial-kpis',
  cap_table:                      'financial-cap-table',
  profit_loss:                    'financial-pnl',
  balance_sheet:                  'financial-balance-sheet',
  cash_flow:                      'financial-cash-flow',

  // ClickUp
  roadmap_item:                   'clickup-roadmap',
  delivery_item:                  'clickup-delivery',
  internal_task:                  'clickup-tasks-internal',

  // GitHub
  github_commit:                  'github-commits',
  github_pull_request:            'github-pull-requests',
  github_pr_review:               'github-pr-reviews',
  github_commit_public:           'github-commits-public',
  github_pull_request_public:     'github-pull-requests-public',
  github_pr_review_public:        'github-pr-reviews-public',

  // HubSpot
  hubspot_ticket:                 'hubspot-tickets',
  hubspot_ticket_anon:            'hubspot-tickets-anon',
  hubspot_ticket_self:            'hubspot-tickets-self',

  // Communications
  slack_message:                  'slack-messages',
}

/**
 * Default `tableIdForDocumentType` resolver used by `useEmbeddedChat` when
 * the caller didn't pass an explicit callback. Returns `null` for
 * unrecognized document types so downstream `discussRef` / `displayRef`
 * still short-circuits gracefully on stale or custom types.
 */
export function defaultTableIdForDocumentType(documentType: string): string | null {
  return DEFAULT_DOCUMENT_TYPE_TO_TABLE_ID[documentType] ?? null
}

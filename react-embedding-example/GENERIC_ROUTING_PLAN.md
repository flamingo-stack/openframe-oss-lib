# Plan: Generic, embedder-configurable URL routing & navigation

> Fourth revision (after three source-verified review panels). Net architecture: **don't touch
> the hub's content resolvers**; single-source only the list-URL table (the one thing an embedder
> can't replicate); deliver internal browsing through the **existing** `composeContentUrl` seam +
> a lib default suffix table; and fix the one raw-`<a>` view card by switching it to the lib's
> **existing embed-shim `Link`** (no new component). Verified per-type shapes inline.

## Context (source-verified)

The lib is embedded in a non-hub host (the `react-embedding-example` is the reference). Two bugs +
the internal-browsing need all come from URL/nav logic an embedder must reverse-engineer and can't
replicate.

**Bug #2 — chat entity cards don't display.** Fetch-mode cards: `dispatch.tsx` →
`useChatCardItem(fetchEntry.contentRefType, id)` → `runtime.endpoints.buildListUrl(contentRefType,[id])`
→ `fetch`; `enabled: !!url`, so null URL ⇒ no fetch ⇒ `ChatCardLoader` renders nothing. The embedder
can't write a correct `buildListUrl`: key is **`contentRefType`** (blog fetches as
`blog_post_existing`; hub un-aliases to `blog_post`); per-type shapes live in **14 mapper closures**
(`lib/config/rag-mappers/*.ts`) and differ (`task_ids` vs `ids`, `pageSize`, `limit&filter=all`);
some are **null** (no-fetch: `github_*`, `slack_message`); `marketing_campaign` is **non-RAG**. My
example's `chat-meta.ts` used wrong keys (`roadmap` not `roadmap_item`) + a `?ids=` guess ⇒ null ⇒
roadmap/delivery/onboarding cards render nothing.

**Bug #1 — identity/commands "canceled".** React StrictMode dev double-mount aborts the first fetch;
both hooks already swallow `AbortError` (`use-chat-identity.ts`, the commands effect). Cosmetic dev
noise; **not** nav-related (in-chat clicks `preventDefault` via `ChatCardNavWrap`). Document, don't fix.

**Internal-browsing gap.** The only lib view card that renders a **raw `<a href>`** (full-page nav)
and is mounted on a host route is `onboarding-guide-card.tsx` (used by `OnboardingGuidesCatalogView`/
`OnboardingGuideDetailView` + related rail). Today it deep-links via `runtime.composeContentUrl` or
`build-default-href`, and the example makes it navigate in-app only via a document-level click
interceptor (`app-shell.tsx`). (Verified non-issues: `RoadmapCard`'s grid/`default` variant renders a
`<div>` with no anchor — `RoadmapGrid` doesn't navigate; `delivery-row.tsx` already uses the
**embed-shim `Link`**, which the example registers to react-router via `embed-router-bridge`, so it
already soft-navigates. So roadmap/delivery need no card conversion.)

## Goal

Overarching rule (see §5): **every page-level surface an embedder renders is the same fully-shared,
parameterized lib component the hub renders** — no hub-coupled views, no example stubs/forks. The
scoped changes below make that achievable; **the hub's content resolvers stay untouched**:
1. One shared **list-URL builder** in the lib (the only un-replicable piece) — fixes bug #2 for every
   type; base-configurable (`/api` hub, `/content/api` embedder); the 14 mapper closures delegate to
   it (single source, byte-parity test).
2. **Internal-browsing overrides via the existing `composeContentUrl` seam** + a lib default suffix
   table — the embedder wires one `composeContentUrl` from a lib helper; no hand-rolled suffix map,
   no hub change.
3. The one raw-`<a>` view card (`onboarding-guide-card`) renders via the **existing embed-shim
   `Link`** instead of `<a>`; the host already registers `Link`→its router, so the example deletes
   its interceptor. No new component.

End state: the example holds no per-type URL tables, no hand-rolled `buildListUrl`, no interceptor —
just a base, a small overrides object, and one `composeContentUrl` line.

## Design

### 1. Shared list-URL builder (fixes bug #2; single source)

`src/utils/list-url.ts` (pure, server-safe — obeys the `contexts/index.ts` bundle-split rule;
hub mappers already import from `@flamingo-stack/openframe-frontend-core/utils` server-side):
```ts
const ALIASES: Record<string, string> = { blog_post_existing: 'blog_post' } // mirrors hub LEGACY_TYPE_ALIASES
// One builder per fetch-mode contentRefType. base='' → '/api/...'; base='/content' → '/content/api/...'.
// Bodies are copied VERBATIM from each mapper's current `listApi` (raw, unencoded `join(',')`;
// exact param names). ABSENT key ⇒ no-fetch (null) — do NOT enumerate github_*/slack as null keys.
const BUILDERS: Record<string, (ids: string[], base: string) => string> = {
  roadmap_item:  (ids, b) => `${b}/api/roadmap?task_ids=${ids.join(',')}`,
  delivery_item: (ids, b) => `${b}/api/delivery?task_ids=${ids.join(',')}`,
  internal_task: (ids, b) => `${b}/api/internal-tasks?task_ids=${ids.join(',')}`,
  blog_post:     (ids, b) => `${b}/api/blog/posts?ids=${ids.join(',')}&pageSize=${ids.length}`,
  webinar:       (ids, b) => `${b}/api/programs/webinars?ids=${ids.join(',')}&limit=${ids.length}&filter=all`,
  podcast:       (ids, b) => `${b}/api/programs/podcasts?ids=${ids.join(',')}&limit=${ids.length}&filter=all`,
  event:         (ids, b) => `${b}/api/programs/events?ids=${ids.join(',')}&limit=${ids.length}&filter=all`,
  onboarding_guide: (ids, b) => `${b}/api/onboarding-guides?ids=${ids.join(',')}&limit=${ids.length}`,
  case_study:    (ids, b) => `${b}/api/case-studies?ids=${ids.join(',')}&limit=${ids.length}`,
  product_release: (ids, b) => `${b}/api/releases?ids=${ids.join(',')}&limit=${ids.length}`,
  customer_interview: (ids, b) => `${b}/api/customer-interviews?ids=${ids.join(',')}&limit=${ids.length}`, // list path ≠ detail suffix 'interviews'
  investor_update: (ids, b) => `${b}/api/investor-updates?ids=${ids.join(',')}&limit=${ids.length}`,
}
// marketing_campaign stays a LITERAL case (admin-only, non-RAG) — keep the hub's static-switch
// shape so CodeQL still proves no user-controlled dynamic dispatch; embedders can't hit /api/admin.
export function buildListUrl(contentRefType: string, ids: string[], base = ''): string | null {
  if (ids.length === 0) return null
  const key = ALIASES[contentRefType] ?? contentRefType
  if (key === 'marketing_campaign') return `${base}/api/admin/marketing/campaigns?ids=${ids.join(',')}&pageSize=${ids.length}`
  const fn = BUILDERS[key]
  return fn ? fn(ids, base) : null
}
```
- **The builder bodies are copied verbatim from the real mappers** (the snippet reflects the verified
  shapes, but the implementer copies each `listApi` string). The 14 mapper `listApi` then **delegate**
  (`listApi: (ids) => buildListUrl('<type>', ids)`), so there's one source. **KEEP**
  `entity-list-api.ts`'s `LEGACY_TYPE_ALIASES` un-rename: its callers (the chat dispatcher's
  `endpoints.buildListUrl`, `related-content-card`, `app/api/chat/entity-list/route`) pass
  `blog_post_existing` and rely on it to reach the `blog_post` mapper before the RAG lookup; the
  delegating mapper closures pass the **canonical** type, so they never exercise it. The lib
  `buildListUrl` carries its OWN `ALIASES` for direct lib/embedder callers. So both entry points
  un-alias (correct) — the "alias in one place" goal is dropped (it would require rewiring
  `entity-list-api.buildListUrl` to delegate to the lib, which is out of scope).
- **Embedder:** `endpoints.buildListUrl = (t, ids) => buildListUrl(t, ids, '/content')`.
- **Parity gate (required, all types incl. the `blog_post_existing` alias + `marketing_campaign`):**
  FIRST capture each mapper's current `listApi(['a','b'])` output into a test fixture (snapshot the
  baseline strings), THEN assert `buildListUrl(type, ['a','b'])` byte-equals that fixture (and that
  `entity-list-api.buildListBasePath`, which probes `buildListUrl`, is unchanged). Convert **all 12
  mappers in the same change** (no half-migrated two-source state). Guards the path/param drift the
  panels caught.

`useChatCardItem` is unchanged; both hub + embedder set `buildListUrl` to a correct builder → every
fetch-mode card resolves a real URL; null types stay no-fetch. `ChatRef.url` (server `resolveUrl`)
remains authoritative for the card's link — this governs only the row fetch.

### 2. Internal-browsing overrides via the existing `composeContentUrl` seam (the user's ask)

Leave the hub's `buildContentURL`/`resolveUrl`/`buildDevSectionUrl`/`getPlatformDomain` alone. Give
embedders a lib helper + default suffix table to wire the **existing** `runtime.composeContentUrl`
seam without duplicating the hub's suffix map.

`src/utils/content-href.ts` (pure, server-safe):
```ts
// type -> in-app route suffix. Public-hostable subset; mirrors the public entries of the hub's
// PUBLIC_URL_PATHS (hub keeps its own copy; this is the embedder default, must stay in sync).
// NO slug-vs-id field: the composeContentUrl seam receives an already-resolved id STRING, so the
// CALLER passes the right id (the onboarding views pass guide.slug).
export const DEFAULT_CONTENT_SUFFIXES: Record<string, string> = {
  onboarding_guide: 'onboarding-guides', product_release: 'releases', blog_post: 'blog',
  case_study: 'case-studies', customer_interview: 'interviews', investor_update: 'investor-updates',
  webinar: 'webinars', podcast: 'podcasts', event: 'events',
}
export interface ContentHrefOptions {
  hostedTypes: ReadonlySet<string>   // types THIS host serves in-app → relative href
  contentOrigin: string              // hub origin for everything else
  suffixes?: Record<string, string>  // defaults to DEFAULT_CONTENT_SUFFIXES
  overrides?: Record<string, (slug: string) => { href: string; targetPlatform: string | null }>
}
// ALWAYS returns a tuple (NEVER null) — the composeContentUrl seam type is non-nullable and the two
// onboarding views read `.href` unconditionally. Internal-vs-hub is decided by `hostedTypes`
// membership (NOT platform equality — embedders have a free-form source). Unknown type with no
// suffix ⇒ hub origin with the raw type as a last resort.
export function makeComposeContentUrl(opts: ContentHrefOptions):
  (type: string, slug: string, platforms?: Array<{ name?: string }>) => { href: string; targetPlatform: string | null }
```
Resolution: `overrides[type]` → else `const seg = suffixes[type] ?? type` (never `/undefined/…`);
if `hostedTypes.has(type)` return relative `/<seg>/<slug>` (in-app) else
`${contentOrigin}/<seg>/<slug>` (hub, opens out). The caller passes the correct identifier as
`slug` (the onboarding views pass `guide.slug`).

- **Embedder** wires the existing seam in one line:
  `composeContentUrl: makeComposeContentUrl({ hostedTypes: new Set(['onboarding_guide','product_release']), contentOrigin: VITE_HUB_ORIGIN })` (only the types the example actually routes; everything else opens the hub).
  Deletes `content-routes.ts`. (Roadmap/delivery `overrides` are optional + **forward-looking**:
  `composeContentUrl` is consumed only by the two onboarding views today; roadmap/delivery cards get
  their href from `ChatRef.url`/grid props, so add overrides only when a view composes those hrefs.)
- **Hub:** unchanged.

### 3. The one raw-`<a>` view card → existing embed-shim `Link`

`onboarding-guide-card.tsx` (all 3 variants) currently renders `<a href target rel>`. Switch it to
the lib's existing `embed-shims/next-link` `Link` (the same primitive `delivery-row.tsx` already
uses), passing the card's existing `href` prop, the `{ target, rel }` from `useEntityCardLink`
(that hook returns only `target`/`rel` — `href` is the card's own prop), and **`prefetch={false}`**
(match `delivery-row`; otherwise next/link prefetches all dozens of catalog cards on the hub). Effects:
- **Embedder:** it registers `Link`→react-router (`embed-router-bridge`), so catalog/detail/related
  onboarding cards soft-navigate in-app — and the example **deletes** its `app-shell` document
  interceptor + `router-nav.ts`.
- **Hub:** registers `Link`→`next/link`, so behavior is unchanged.
- **In chat:** the card stays wrapped by `ChatCardNavWrap` (whose `onClickCapture` `preventDefault`s
  and routes through `runtime.navigation`), so chat nav is unaffected regardless of `<a>` vs `Link`.
- No new `<ContentLink>` component; no chat coupling added to non-chat cards. roadmap-card/delivery
  are **not** converted (grid roadmap card has no anchor; delivery already uses `Link`).
- **Gate (explicit checklist, not a grep caveat):** the example registers `Link`→react-router, so
  any lib surface already on the embed-shim `Link` keeps soft-navigating after the interceptor is
  removed. Before deleting `app-shell`'s interceptor + `router-nav.ts`, confirm **each** lib view
  surface the example mounts is either on the embed-shim `Link` or routes via `runtime.navigation`:
  | Surface | mounted by | nav today | action |
  |---|---|---|---|
  | onboarding-guide-card (catalog/sm/default) | catalog + detail views | raw `<a>` | **convert to `Link`** |
  | onboarding detail back-link | detail view | embed-shim `Link` | none (already `Link`) |
  | onboarding related-rail cards | detail view | = onboarding-guide-card | covered by the conversion |
  | DocSearchBar result rows | catalog view | `useDocSearch` → react-router push | none |
  | RoadmapGrid / RoadmapCard (grid) | `/roadmap` | no anchor (vote card) | none |
  | DeliveryTable / delivery-row | `/delivery` | embed-shim `Link` | none |
  | ReleaseDetailPage, LegalDocumentPage, ContactForm, HelpCenterList, AnnouncementBar | their routes | internal `Link`/own fetch, no host `/…` `<a>` | none |
  Delete the interceptor only once every row is "none" or converted. (The example's own JSX has zero
  raw `<a href>`.)

### 4. Bug #1 — document only

StrictMode dev-only canceled-request noise (AbortError already swallowed in both hooks). No nav fix.
Optionally drop `<React.StrictMode>` in the example dev entry to silence it (cosmetic).

### 5. Rule of thumb — every page-level surface is a fully-shared, parameterized lib component

**Principle (applies to ALL surfaces, not just releases):** an embedder must render the *same*
lib component the hub renders. No hub-coupled page/list/detail view, and no example stub or fork.
If a surface today lives hub-side (imports `@/…`) or the example hand-rolls it, that surface must
be **lifted into the lib and parameterized** so hub + every embedder share one implementation. The
decoupling recipe is uniform (already established by §1–§3 and the existing shared views):
- **data** via props (server-fetched, like `OnboardingGuidesCatalogView.initialGuides`) or a
  configurable endpoint — never a hard-wired hub hook;
- **card props** via the lib default (e.g. `defaultBuildProductReleaseCardProps`) overridable
  through the existing `extras.*` seam — never a hub-only `@/lib/utils/*` builder;
- **nav** via `runtime.composeContentUrl` (§2) + embed-shim `Link`/`useEntityCardLink` (§3) —
  never `@/lib/utils/use-nav-link` / `currentPlatform`;
- **chrome** via already-lib primitives (`PersistentPaginationWrapper`, `EmptyState`,
  `DevSectionPage`, embed-shim `useSearchParams`).

**Audit (do this as part of the work):** for every surface the example mounts, confirm it imports a
lib component, not a hub-local one or an example stub. Known violators today:

| Surface | Lib list/view export today | Status |
|---|---|---|
| Onboarding | `OnboardingGuidesCatalogView` | ✅ shared |
| Roadmap | `RoadmapGrid` | ✅ shared |
| Delivery | `DeliveryLists` | ✅ shared |
| Legal / Contact / Tickets / Announcements | `LegalDocumentPage` / `ContactForm` / `HelpCenterList` / `AnnouncementBar` | ✅ shared |
| **Product releases (LIST)** | ❌ only `ProductReleaseCard` + `ReleaseDetailPage` — **no list view** | **lift (below)** |

**Worked instance — lift `ReleasesList` → lib `ProductReleasesView`.** The releases LIST lives
hub-side at `multi-platform-hub/components/releases/product-releases-tab-content.tsx` (`ReleasesList`),
coupled to `@/hooks/api/use-product-releases`, `@/lib/utils/product-release-card-props`,
`@/lib/utils/use-nav-link`, `@/lib/platform-utils-shared`; the example currently ships a hand-rolled
slug-input stub (`pages/releases.tsx`) instead — the discrepancy vs the hub/testing app. Lift it as
`ProductReleasesView` per the recipe above (props-driven rows + `defaultBuildProductReleaseCardProps`
+ `composeContentUrl`/embed-shim `Link` + the already-lib `PersistentPaginationWrapper`/`EmptyState`).
Then the hub's `ReleasesList` becomes a thin wrapper (or is replaced) and the example renders
`<ProductReleasesView items={…} />` — all list pages share one component. Apply the same lift to any
other violator the audit surfaces.

## Precedence (unambiguous)

- **Chat inline card link:** `ChatRef.url` (server `resolveUrl`) — authoritative, unchanged.
- **Chat card row fetch:** `runtime.endpoints.buildListUrl` = lib `buildListUrl(type, ids, base)`.
- **View content link (onboarding catalog/detail/related):** `runtime.composeContentUrl(...)`
  (embedder wires via `makeComposeContentUrl`, always returns a tuple) `?? build-default-href` (fires
  only when the composer is absent). Hub keeps its own `composeContentUrl`.

## Files

**Lib (`openframe-frontend-core`)**
- new `src/utils/list-url.ts` + `src/utils/content-href.ts`; export from `utils/index.ts`.
- the 12 mapper files under `src/config/rag-mappers/` whose `listApi` exists — delegate to
  `buildListUrl`. (`rag-mappers/types.ts`/`rag-table-config.ts` keep the `listApi` field as a thin
  delegate.) **Keep** `entity-list-api.ts`'s `LEGACY_TYPE_ALIASES` (hub entry-point un-alias); the
  lib `buildListUrl` has its own `ALIASES` for direct callers.
- `src/components/chat/entity-cards/onboarding-guide-card.tsx` — raw `<a>` → embed-shim `Link`.
- new `src/components/shared/product-release/product-releases-view.tsx` (`ProductReleasesView`) +
  export from the `product-release` barrel — the lifted, decoupled `ReleasesList` (§5).

**Hub (`multi-platform-hub`)** — content resolvers UNCHANGED. Only the mapper-delegation above
(in the lib) flows through; `entity-list-api.ts` keeps its lookup (alias now upstream).

**Example (`react-embedding-example`)**
- delete `src/config/content-routes.ts`, `src/providers/router-nav.ts`, the `app-shell` interceptor,
  the hand-rolled `composeContentUrl` body, `src/config/chat-meta.ts`'s `buildListUrl`.
- `endpoints.buildListUrl = (t,ids) => buildListUrl(t, ids, '/content')`.
- `composeContentUrl = makeComposeContentUrl({ hostedTypes, contentOrigin: VITE_HUB_ORIGIN })`.

## Rollout (no broken intermediate state)

1. Land `src/utils/list-url.ts` + `content-href.ts` + the parity test (pure; no consumers).
2. Switch the 12 mapper `listApi` to delegate (parity test green ⇒ output identical). Hub
   `LEGACY_TYPE_ALIASES` stays.
3. Switch `onboarding-guide-card` to the embed-shim `Link`.
4. Example: wire `buildListUrl`/`composeContentUrl` from lib helpers; delete the shims + interceptor;
   verify.
5. Lift `ReleasesList` → lib `ProductReleasesView` (§5); replace the example's stub
   `pages/releases.tsx` with `<ProductReleasesView items={…} />`. Run the §5 audit and lift any other
   surface that's still hub-coupled or example-stubbed.

## Verification

- **Bug #2:** in the example chat, queries returning roadmap_item / delivery_item / blog_post /
  onboarding_guide / program cards → each **fetches** with the correct per-type params (`task_ids`,
  `programs/…&filter=all`, `blog/posts&pageSize`) and renders the full row; `github_*`/`slack` stay
  no-fetch. A test distinguishes "card present + fetched" from "no `[card://]` marker emitted" (latter
  unchanged, out of scope).
- **Parity:** `buildListUrl(type, ids)` byte-equals every mapper's prior `listApi(ids)` (all types +
  alias + marketing_campaign); `buildListBasePath` unchanged.
- **Internal browsing:** onboarding catalog/detail/related cards navigate **in-app** (relative href
  via the registered `Link`) with the example's interceptor **deleted**; a non-hosted type opens the
  hub origin. (Roadmap/delivery grids already non-navigating / `Link`-routed.)
- **Bug #1:** identity/commands complete; any "canceled" is a single StrictMode artifact.
- **Hub unchanged:** content + list URLs identical before/after (parity test + spot snapshots).
- **DRY:** no per-type URL table outside `src/utils/{list-url,content-href}.ts`; example has no suffix
  mirror, no hand-rolled `buildListUrl`, no interceptor.
- **Fully-shared surfaces (§5 rule):** every example page imports a lib component — `releases` renders
  `<ProductReleasesView>` (the stub is gone); the §5 audit table is all ✅ (no hub-coupled view, no
  example fork remains).
- `npm run typecheck` clean in lib + example; hub builds.

## Open questions

- Does any host want the onboarding card to route through `runtime.navigation` (chat-style
  close-on-nav / embed new-tab) rather than the plain `Link`? If so, a small optional-runtime link
  wrapper could be added later — not needed for the example (the registered `Link` → react-router is
  the host's own nav). Decided: ship the `Link` switch; revisit only if a host needs chat-style nav
  on non-chat surfaces.
- Ship the list builders as the data the hub mappers import (chosen) — the parity test exists only to
  make the migration safe, after which the closures are pure delegates.

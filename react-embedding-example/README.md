# react-embedding-example

A standalone **Vite + React** app that embeds the chat (`EmbeddableChat`) and every
page-level content surface from `@flamingo-stack/openframe-frontend-core` (onboarding
guides, roadmap, delivery, product releases, authors, legal, contact, tickets,
announcements), talking to the multi-platform hub through a **`/content` reverse proxy**.

The proxy holds the **chat secret** and injects a **fixed identity** (Michael Assraf), so
the chat greets that user with no client-side auth — exactly how a real embedder works.

## How this maps to production

In production the client is React and the proxy is an existing **Spring Boot** service. The
local proxy here (`proxy/`, or Vite's built-in dev proxy) is a stand-in that does the same
two things Spring Boot already does:

1. Rewrite `/content/api/*` → `${HUB_ORIGIN}/api/*`.
2. Inject `Authorization: Bearer ${CHAT_PROXY_SECRET}` + `X-Chat-Act-As` / `-First-Name` /
   `-Last-Name` / `-Avatar-Url`.

The React client is byte-identical in both — it only ever calls `/content/api/...`. The
secret + identity live **only** on the proxy (non-`VITE_` env), never in the browser bundle.

```
Browser SPA ──fetch('/content/api/...')──▶ proxy (rewrite + inject secret/identity) ──▶ hub /api/*
```

## Prerequisites

1. **Build the lib** (it's a `file:` dependency; `dist/` must exist):
   ```bash
   cd ../openframe-frontend-core && npm install && npm run build
   ```
2. **Run the hub** locally on `:3000` (or point `HUB_ORIGIN` elsewhere). From a Claude/IDE
   subshell prefix with `unset ANTHROPIC_API_KEY` (Claude Desktop shadows it and chat 500s):
   ```bash
   unset ANTHROPIC_API_KEY && npm run dev:openframe   # in the hub repo
   ```
3. **Set the shared secret.** Copy `.env.example` → `.env` and set `CHAT_PROXY_SECRET` to the
   **same** value the hub uses. If empty, the hub returns `503 CHAT_PROXY_SECRET_NOT_CONFIGURED`
   and chat errors loudly.

## Run

```bash
cp .env.example .env          # then edit CHAT_PROXY_SECRET (+ HUB_ORIGIN if not :3000)
npm install
npm run dev                   # Vite dev server proxies /content → hub, injecting secret + identity
# → open the printed URL; the floating "Ask AI" chat greets Michael.
```

Built-app path (uses the standalone Node proxy instead of Vite's):
```bash
npm run build && npm run preview:proxy
```

## Configuration (`.env`)

| Var | Side | Purpose |
|-----|------|---------|
| `HUB_ORIGIN` | server only | Where `/content/api/*` is forwarded. Default `http://localhost:3000`. |
| `CHAT_PROXY_SECRET` | server only | Shared secret — must equal the hub's. |
| `ACT_AS_EMAIL` / `ACT_AS_FIRST_NAME` / `ACT_AS_LAST_NAME` / `ACT_AS_AVATAR_URL` | server only | The impersonated identity (defaults to Michael Assraf). |
| `VITE_HUB_ORIGIN` | client | Public hub origin for new-tab "open full content" links. |

> There is intentionally **no chat-source / platform variable**. The client is platform-agnostic: the chat wire resolves `source` server-side (the hub's `currentPlatform()`), client-side same-tab/new-tab link decisions fall back to an origin comparison, and the chat-history namespace falls back to a lib default. Point `HUB_ORIGIN` at any platform's hub and it just works.

## How it's wired

- **Single base.** The `/content` prefix lives once in [`proxy/content-prefix.mjs`](proxy/content-prefix.mjs);
  every endpoint derives from it in [`src/config/endpoints.ts`](src/config/endpoints.ts) (the `EP` map).
- **Runtime.** [`src/providers/content-runtime.ts`](src/providers/content-runtime.ts) builds the
  lib's `ChatRuntime` + `EndpointsRuntime` from `EP`; mounted (memoized) in
  [`app-providers.tsx`](src/providers/app-providers.tsx) alongside `QueryClientProvider`.
- **Routing.** [`embed-router-bridge.tsx`](src/providers/embed-router-bridge.tsx) adapts
  react-router into the lib's `embed-shims` so lib pages navigate in-app.
- **Theme.** `data-theme="dark"` on `<html>` drives the ODS tokens shipped by the lib's
  `/styles` import — no theme provider needed.

## Endpoint map

All client calls use `/content/api/...`. Per-surface retargeting:

| Surface | Endpoint(s) | Retargeted via |
|---------|-------------|----------------|
| Chat (`EmbeddableChat`) | `/content/api/docs/chat`, `/commands`, `/auth/identity`, … | `ChatRuntime` |
| Onboarding catalog/detail | `/content/api/onboarding-guides[/:slug\|/sections]` | props-driven fetch (`content-api.ts`) |
| Roadmap | `/content/api/roadmap`, `/roadmap/vote`, `/roadmap/:id` | `items` + `buildRefreshUrl` + `votingOptions` |
| Delivery | `/content/api/delivery/{completed,in-progress}` | `completedApiEndpoint` / `inProgressApiEndpoint` |
| Release detail | `/content/api/product-releases/:slug`, `/roadmap` | host `useRelease` + injected section |
| Authors (`ArticleAuthorByline` + `RelatedContentSection authorId`) | `/content/api/related-content?authorId=…` + per-type list endpoints, `/content/api/image-proxy` (avatar) | `apiBaseUrl` prop + ambient `ChatRuntime` |
| Legal | `/content/api/legal/:docType` | `apiEndpoint` |
| Contact | `/content/api/contact` | `EndpointsRuntime.contactUrl` |
| Announcements | `/content/api/announcements/active` | `EndpointsRuntime.announcementsUrl` |

### Two documented `/api` exceptions (dev only)

Two lib surfaces still hardcode bare `/api` with no override prop today:
- the onboarding **catalog's in-view doc-search** → `/api/docs/search`
- the **tickets** hooks → `/api/chat/agent/{find-ticket,ticket-action,list-engagements}`

`vite.config.ts` (and `proxy/server.mjs`) add a narrow fallback that forwards just those two
prefixes to the hub. Everything else rides `/content`. The clean fix (recommended) is a small
lib change so these read their base from the runtime — forward a `searchEndpoint` prop from
`OnboardingGuidesCatalogView`, and derive the tickets paths from a single `agentBaseUrl` on
`ChatRuntime.endpoints` (sibling of `approvalToolUrl`). After that, drop the fallback rules.

## Configuring URL endpoints

Every hub call is `/content/api/<path>`, and every such string is derived **once** from the
shared `/content` prefix — no endpoint literal appears twice.

| To change… | Edit | Effect |
|---|---|---|
| **Which hub** the proxy forwards to | `.env` → `HUB_ORIGIN` (server) + `VITE_HUB_ORIGIN` (client, new-tab links) | `/content/api/*` → `${HUB_ORIGIN}/api/*` |
| **The client-facing namespace** (`/content`) | `proxy/content-prefix.mjs` (single source, imported by client + proxy + Vite) | renames the prefix everywhere at once |
| **An individual endpoint** | `src/config/endpoints.ts` (the `EP` map) | every page/runtime reads from `EP`, so one edit retargets all callers |

`EP` is the single table; `src/providers/content-runtime.ts` feeds it into the lib's
`ChatRuntime.endpoints` + `EndpointsRuntime`, and each page passes the relevant `EP.*` to
its component's endpoint prop. To repoint a surface, change its `EP` entry — never hand-write
a URL in a page.

## Configuring routes & navigation

Two distinct concerns, configured in two places:

### 1. The app's own page routes — `src/app-routes.tsx`

Plain react-router; each `<Route>` mounts a lib page. The paths are yours, but they must
match what you tell the lib about *where content lives* (§2–3) so a chat card and a nav link
land on the same place.

```tsx
<Route path="roadmap"        element={<RoadmapPage />} />
<Route path="delivery"       element={<DeliveryPage />} />
<Route path="releases/:slug" element={<ReleaseDetailRoute />} />
```

### 2. Where *content* navigates — `composeContentUrl` (in `content-runtime.ts`)

When the chat renders an entity card (release, roadmap item, …) or a page lists links, the
lib asks **one resolver** "where does this go?". Wire it once → chat cards and page links
agree. Resolution order: `overrides[type]` → `hostedTypes` (relative) → row `externalUrl` →
`contentOrigin`.

```ts
composeContentUrl: makeComposeContentUrl({
  // (a) Types YOU host on a slugged detail route → relative in-app href (soft-nav).
  hostedTypes: new Set(['onboarding_guide', 'product_release']),
  // (b) Fallback origin for everything else → opens on the hub in a new tab.
  contentOrigin: HUB_PUBLIC_ORIGIN,
  // (c) Per-type override — full control. List-filter types (no detail page) deep-link
  //     into a list route with the query param the page reads (`?search=<id>`).
  overrides: {
    roadmap_item:  (id) => ({ href: `/roadmap?search=${id}`,  targetPlatform: null }),
    delivery_item: (id) => ({ href: `/delivery?search=${id}`, targetPlatform: null }),
  },
}),
```

| Content type | Resolution | Lands at |
|---|---|---|
| `onboarding_guide`, `product_release` | `hostedTypes` | in-app `/<suffix>/<slug>` |
| `roadmap_item`, `delivery_item` | `overrides` | in-app `/<route>?search=<id>` (filtered to that item) |
| `podcast`, `webinar`, `blog_post`, `author`, … | default | hub origin, new tab |

### 3. Where *doc chips* navigate — `docPlatformTargets` (in `content-runtime.ts`)

Doc chips (`markdown` = product docs, `data_room_doc` = data room) carry no public URL, so
they're routed **per `documentType`** to the platform whose public doc viewer hosts them — a
chat mixing several doc sources sends each to its own home, no single static fallback:

```ts
docPlatformTargets: {
  markdown:      { platform: 'flamingo',    basePath: 'knowledge-base' },
  data_room_doc: { platform: 'company-hub', basePath: 'data-room' },
},
// markdown chip → getBaseUrl('flamingo')/knowledge-base/<path>, opened in a new tab.
```

### 4. Shared-page chrome — `DevSectionPage` props

The roadmap / delivery / releases pages share `DevSectionPage`. Its hero **title**,
**subtitle**, and **back button** default to the section's (OpenFrame) copy but are
per-page overridable — nothing is hard-shared:

```tsx
<DevSectionPage
  sectionKey="roadmap"
  title="Our Roadmap"                          // override the default hero title
  subtitle="What we're shipping next."         // override the default subtitle
  backButton={{ label: 'Back', href: '/' }}    // customize, or `false` to hide
>
  <RoadmapView … />
</DevSectionPage>
```

## Add a surface

1. Add the endpoint(s) to `EP` in `src/config/endpoints.ts`.
2. Add a page under `src/pages/` that renders the lib component (data via `content-api.ts` or
   the component's own endpoint props).
3. Register one `<Route>` in `src/app-routes.tsx`.
4. If the chat can reference this content, point the lib at the new page — add the type to
   `hostedTypes` / `overrides` in `composeContentUrl` (see *Configuring routes & navigation*).

## Troubleshooting

- **`[vite] Failed to load url …/dist/components/<x>/index.js`** — the lib is a `file:`
  dependency whose dev watcher (`yalc:watch`) runs `rm -rf dist && tsup` on every lib source
  edit. Vite reads the linked `dist` on demand, so a page load that lands in that ~1s rebuild
  window transiently can't find the file. It's harmless: **reload once the lib rebuild
  finishes**. If it persists, the lib build failed or is stale — rebuild it:
  `cd ../openframe-frontend-core && npm run build`.
- **Doc / roadmap / delivery chips don't navigate** — check `composeContentUrl` /
  `docPlatformTargets` in `content-runtime.ts` (see *Configuring routes & navigation*); an
  unmapped type falls back to Ask-only or the hub origin.
- **Chat 500s with `CHAT_PROXY_SECRET_NOT_CONFIGURED`** — `.env`'s `CHAT_PROXY_SECRET` must
  equal the hub's.

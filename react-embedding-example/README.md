# react-embedding-example

A standalone **Vite + React** app that embeds the chat (`EmbeddableChat`) and every
page-level content surface from `@flamingo-stack/openframe-frontend-core` (onboarding
guides, roadmap, delivery, product releases, legal, contact, tickets, announcements),
talking to the multi-platform hub through a **`/content` reverse proxy**.

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

> There is intentionally **no chat-source / platform variable**. The chat `source` is resolved at runtime from the proxied hub's `/auth/identity` (its server-side `currentPlatform()`) by the lib's `<EmbedChatRuntimeProvider>` — point `HUB_ORIGIN` at any platform's hub and the embed follows automatically. The client is never platform-aware.

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

## Add a surface

1. Add the endpoint(s) to `EP` in `src/config/endpoints.ts`.
2. Add a page under `src/pages/` that renders the lib component (data via `content-api.ts` or
   the component's own endpoint props).
3. Register one `<Route>` in `src/app-routes.tsx`.

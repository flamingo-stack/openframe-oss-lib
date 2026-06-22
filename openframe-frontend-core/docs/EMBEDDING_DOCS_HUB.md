# Embedding `<DocsHubPage>` in a third-party React app

This guide shows how to embed the docs-hub experience — sidebar tree + content
area + scroll-spy + RAG search bar — into a non-hub React app. The component
is what the hub itself mounts at `/knowledge-base` and `/data-room`, so the
behavior you embed is the behavior the hub ships.

> First time embedding lib components? Read [`EMBEDDING.md`](./EMBEDDING.md)
> for the runtime-provider setup (`EndpointsRuntimeContext` /
> `ChatRuntimeContext`). This guide doesn't re-document that — it focuses on
> the docs-hub-specific surface.

---

## 1. What it is

`<DocsHubPage>` bundles the lib's `<DocViewer>` with safe defaults so the
minimum embed is essentially one line. You bring:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  <PageHeading title>                                                    │
│  ┌─────────────┐  ┌─────────────────────────────────────────────────┐   │
│  │             │  │  [optional RAG search bar — showAIChat=true]    │   │
│  │  sidebar    │  ├─────────────────────────────────────────────────┤   │
│  │  tree       │  │                                                 │   │
│  │  (folders   │  │   document body                                 │   │
│  │   + files)  │  │   (markdown / pdf / sheet / figma / file)       │   │
│  │             │  │                                                 │   │
│  └─────────────┘  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

The component is `'use client'`. Server-side SEO is the host's job (see §8).

---

## 2. Minimum embed

### Next.js

```tsx
// app/docs/page.tsx
import { DocsHubPage } from '@flamingo-stack/openframe-frontend-core/components/docs'
import ReactMarkdown from 'react-markdown'

export const dynamic = 'force-dynamic'

export default function DocsPage() {
  return (
    <DocsHubPage
      sourceId="openframe-docs"
      baseRoute="/docs"
      chatSource="my-app"
      title="Docs"
      documentTypeRenderers={{
        markdown: (content) => <ReactMarkdown>{content.content}</ReactMarkdown>,
      }}
    />
  )
}
```

### Standalone React (Vite / CRA)

Same component import; mount inside your runtime-provider tree (§3):

```tsx
import { DocsHubPage } from '@flamingo-stack/openframe-frontend-core/components/docs'
import ReactMarkdown from 'react-markdown'

export function DocsScreen() {
  return (
    <DocsHubPage
      sourceId="openframe-docs"
      baseRoute="/docs"
      chatSource="my-app"
      title="Docs"
      documentTypeRenderers={{
        markdown: (content) => <ReactMarkdown>{content.content}</ReactMarkdown>,
      }}
    />
  )
}
```

That's it. `pdf`, `google_sheet`, `figma`, `file` all default to the lib's
embed renderers — you only need to override them if you want different props
(e.g. a custom PDF toolbar).

---

## 3. Runtime providers

The default-config flow is documented in [`EMBEDDING.md`](./EMBEDDING.md):
mount `EndpointsRuntimeContext.Provider` at your app root, optionally
`ChatRuntimeContext.Provider` if you want chat-aware link behavior.

**Important nuance for `<DocsHubPage>`:** `showAIChat` (default `true`) only
mounts the in-source RAG search bar (`<DocSearchBar>`). It does NOT require
`ChatRuntimeContext` — the search bar calls `useChatRuntime()` which returns
`null` when no provider is mounted, and the search bar gracefully degrades.
The fully-fledged chat panel (`<EmbeddableChat>`) is a separate component;
see [`CHAT_EMBEDDING_TUTORIAL.md`](./CHAT_EMBEDDING_TUTORIAL.md) for that
setup.

---

## 4. API contract the embedder must implement

The component calls three endpoints. Defaults are derived from `sourceId`,
override via `structureEndpoint` / `contentEndpoint` props if you proxy under
a different prefix.

### `GET /api/docs/sources/[sourceId]/structure` → `DocNode[]`

Returns the doc tree. The lib re-exports `DocNode` so you don't have to
redeclare the shape:

```ts
import type { DocNode } from '@flamingo-stack/openframe-frontend-core/components/docs'

// Implement on your side:
async function getStructure(sourceId: string): Promise<DocNode[]> {
  // shape:
  // [{ id, name, slug, path, type: 'file' | 'folder',
  //    documentType?: 'markdown' | 'pdf' | 'google_sheet' | 'figma' | 'file',
  //    hasReadme?, sortOrder?, children? }]
}
```

### `GET /api/docs/sources/[sourceId]/content?path=...` → `DocContent | null`

Returns the body for a single doc:

```ts
import type { DocContent } from '@flamingo-stack/openframe-frontend-core/components/docs'

// shape:
// { content: string, sections: [{ id, title, level }], path,
//   documentType?, brokenLinks?,
//   // rich-content fields (data-room style)
//   fileUrl?, externalUrl?, mimeType?, fileName?, fileSize?,
//   publishedAt?, updatedAt? }
```

### `GET /api/docs/search` — only when `showAIChat: true`

In-source RAG search endpoint backing the `<DocSearchBar>` mounted inside
`<DocsHubPage>`. The hook (`useDocSearch`) sends `q`, `source`, `limit`
(optional `tableIds`) as query params and expects `{ success, data: [...] }`
back. When embedding in your own React app, host this endpoint in your own
server (or proxy to a hub) and pass `chatSource` as a stable
server-trusted discriminator the server uses to scope sources to your app.

The full streaming chat panel (`POST /api/docs/chat`) is a separate
component (`<EmbeddableChat>`) — see [`CHAT_EMBEDDING_TUTORIAL.md`](./CHAT_EMBEDDING_TUTORIAL.md)
for that surface's contract.

### `POST /api/docs/resolve-link` — used by the markdown renderer's link resolver

When the user clicks a relative link inside a doc (e.g. `[intro](./getting-started/intro.md)`),
the markdown renderer needs to resolve the href against the current doc path
BEFORE navigating — otherwise the raw `./getting-started/intro.md` reaches the
content endpoint verbatim and 404s. `<DocViewer>` exposes this via
`handlers.onResolveLink` (threaded into `renderContent`'s second arg); thread
it into your markdown renderer's resolve-link callback.

Body: `{ link: string, currentPath: string, source: DocSourceId }`. Response:
`ResolveLinkResult { success, resolvedPath?, type?, action? }`.

### Proxy-prefix variant

If your reverse proxy rewrites `/api/<your-prefix>/*` → some upstream, pass:

```tsx
<DocsHubPage
  sourceId="openframe-docs"
  structureEndpoint="/api/my-prefix/docs/sources/openframe-docs/structure"
  contentEndpoint="/api/my-prefix/docs/sources/openframe-docs/content"
  searchEndpoint="/api/my-prefix/docs/search"
  resolveLinkEndpoint="/api/my-prefix/resolve-link"
  // ...
/>
```

Or — to match the rest of the lib's runtime-injection pattern (tickets, chat,
etc.) — set the endpoints once on `ChatRuntimeContext.endpoints`
(`docsSearchUrl` + `docsResolveLinkUrl`) at your app root and skip the props
entirely; both resolve prop → runtime → hub default in that order.

---

## 5. `documentTypeRenderers` — picking content renderers per type

The map's `markdown` key is **required** (the lib does not ship a default
markdown renderer to avoid forcing a `marked` / `react-markdown` peer dep +
XSS-sanitization opinion on every embedder).

Other keys default to the lib's existing embed components:

| Key | Default renderer (lib) | Override when… |
|---|---|---|
| `markdown` | **none — required** | (always) |
| `pdf` | `<PdfViewer>` | …you need custom toolbar, embedded credentials, etc. |
| `google_sheet` | `<GoogleSheetsViewer>` | …you wrap the embed in your own auth iframe. |
| `figma` | `<FigmaEmbed>` | …you want a different default zoom / view. |
| `file` | `<FileDownloadCard>` | …you have a custom download UI. |

Worked example — add a `notion` type (assumes you also extend the server's
`DocumentType` union):

```tsx
<DocsHubPage
  // ...
  documentTypeRenderers={{
    markdown: (c) => <ReactMarkdown>{c.content}</ReactMarkdown>,
    // @ts-expect-error custom type your server emits
    notion: (c) => <iframe src={c.externalUrl} className="w-full h-screen" />,
  }}
  fallbackRenderer={(c) => (
    <div className="p-4">No renderer for type <code>{c.documentType}</code></div>
  )}
/>
```

---

## 6. `chatSource` — security contract

`chatSource` (passed through to `<DocSearchBar>`) MUST be a server-rendered
constant or a build-time literal. It identifies your app to the chat backend
for RAG-scope filtering and prompt-injection logging.

**Never** read it from:

- `window.location.*`
- query params or URL fragments
- `localStorage` / `sessionStorage`
- any input the user can shape

Per the doc-viewer JSDoc on the underlying `chatSource` prop: "Lib has no
platform context; the page shell is the trusted boundary that wires this.
NEVER pass user input here."

In the hub, `chatSource` is `currentPlatform()` resolved server-side. In a
non-Next.js embedder, hardcode the value or inject it via a build-time env
variable.

---

## 7. Title

`title` accepts `ReactNode | string`. String renders inside the lib's
`<PageHeading>`. Pass a full node when you want a custom header
(subtitle, accent dot, right-side CTA, etc.):

```tsx
<DocsHubPage
  // ...
  title={
    <PageHeading title="Docs" subtitle="Everything about MyApp" accentDot />
  }
/>
```

---

## 8. SEO

`<DocsHubPage>` is `'use client'` — first paint is a loading skeleton, so
crawlers (Google, Slack/LinkedIn/Twitter OG fetchers, Ahrefs) see no content
without server-side help. The host owns this surface.

The hub's [`components/shared/doc-seo-content.tsx`](../../multi-platform-hub/components/shared/doc-seo-content.tsx)
is the canonical reference implementation. It:

1. Reads the same `(sourceId, docPath)` cache the client viewer reads.
2. Emits the full HTML inside an `sr-only` `<article>` so crawlers see the
   text.
3. Emits `Article` + `BreadcrumbList` JSON-LD.

Wrap it in `<Suspense fallback={null}>` so the client viewer renders
immediately and the SEO content streams in.

The cache key is `(sourceId, docPath)` only — the cache hit rate does not
depend on which wrapper component renders the viewer.

---

## See also

- [`EMBEDDING.md`](./EMBEDDING.md) — runtime providers (`EndpointsRuntimeContext`, `ChatRuntimeContext`).
- [`CHAT_EMBEDDING_TUTORIAL.md`](./CHAT_EMBEDDING_TUTORIAL.md) — full chat panel embed.
- [`MIGRATING_COMPONENTS.md`](./MIGRATING_COMPONENTS.md) — how a component lands in this lib in the first place.

/**
 * Single home for doc-source tree + content types.
 *
 * Consumed by every doc-viewer consumer (knowledge base, data room, future
 * sources). Replaces the per-source `OpenFrameDocNode` / `OpenFrameDocContent`
 * / `DataRoomDocNode` / `DocNavNode` types that previously lived in the hub.
 */

/**
 * A single node in a doc-source tree. The `documentType` discriminator
 * defaults to `'markdown'` when undefined; rich-content viewers handle
 * `'pdf' | 'google_sheet' | 'figma' | 'file'`.
 */
export interface DocNode {
  id: string
  name: string
  slug: string
  path: string
  type: 'file' | 'folder'
  hasReadme?: boolean
  /** Per-row sort key — populated by data-room rows, undefined elsewhere. */
  sortOrder?: number
  /** Discriminator for the rich renderer. `undefined` is treated as `'markdown'`. */
  documentType?: 'markdown' | 'pdf' | 'google_sheet' | 'figma' | 'file'
  children?: DocNode[]
}

/**
 * Named alias for `DocNode['documentType']` (non-nullable). Use this as the
 * key type when building per-document-type renderer maps — keeps consumers
 * from re-declaring the union or having to dig into `DocNode`.
 */
export type DocumentType = NonNullable<DocNode['documentType']>

/**
 * Content payload returned by a doc-source DAL's `getContent` call. Carries
 * everything any consumer's renderer might need; markdown-only fields and
 * rich-only fields are both optional.
 */
export interface DocContent {
  content: string
  sections: Array<{ id: string; title: string; level: number }>
  path: string
  /** Defaults to `'markdown'` when undefined. */
  documentType?: DocNode['documentType']
  // Markdown-only
  brokenLinks?: string[]
  // Rich-content (data-room) — optional
  fileUrl?: string
  externalUrl?: string
  mimeType?: string
  fileName?: string
  fileSize?: number
  /** ISO timestamps for SEO `datePublished` / `dateModified` — DAL populates
   *  from the underlying row's sync/update timestamp. Undefined when unknown. */
  publishedAt?: string
  updatedAt?: string
}

/**
 * Doc-source data-access contract. Each doc source's hub-side DAL conforms
 * to this. Generic over the Supabase-client type so the lib doesn't pull in
 * `@supabase/supabase-js`; hub callers tighten `Client` to `SupabaseClient`.
 */
export interface DocSourceDal<Client = unknown> {
  getStructure(client: Client): Promise<DocNode[]>
  getContent(client: Client, path: string): Promise<DocContent | null>
}

/**
 * Doc-source registry id. The lib's `<DocViewer>` is generic over this union
 * — the hub's `DOC_SOURCES` registry defines the actual ids. Listed here as a
 * type-only union so the lib can flow the id into `DocRenderHandlers.sourceId`
 * without callers having to cast `string` → `'openframe-docs' | 'data-room-docs'`.
 *
 * Adding a new source = add the id here AND register it in the hub. The lib
 * never reaches into the registry — this is purely a type-narrowing handle.
 */
export type DocSourceId = 'openframe-docs' | 'data-room-docs'

/**
 * Result returned by the resolve-link endpoint. Discriminator-style: `success`
 * + `type` jointly decide what the renderer does (navigate, expand folder,
 * show broken-link badge). Backed by hub `/api/resolve-link` and any
 * embedder-proxied equivalent.
 */
export interface ResolveLinkResult {
  success: boolean
  resolvedPath?: string
  type?: string
  action?: string
  error?: string
  message?: string
}

/**
 * Handlers the viewer passes to a consumer's `renderContent` callback.
 * The page shell wires `renderContent` directly — no `DocContentRenderer`
 * interface layer between the viewer and the consumer's render logic.
 */
export interface DocRenderHandlers {
  onInternalLinkClick: (
    path: string,
    options?: { expandFolder?: boolean; fromInternalLink?: boolean },
  ) => void
  currentPath: string
  /** Registry source id (e.g. `'openframe-docs'`, `'data-room-docs'`) — used by
   *  the consumer's `/api/resolve-link` POST to disambiguate the doc source. */
  sourceId: DocSourceId
  /**
   * Async link resolver — POSTs the raw markdown href + the current doc's path
   * to the embedder's resolve-link endpoint and returns the resolved tree path.
   * The lib auto-wires this when `DocViewer` knows the resolve-link endpoint
   * (via `resolveLinkEndpoint` prop, `ChatRuntime.endpoints.docsResolveLinkUrl`,
   * or the `/api/resolve-link` default). Consumers thread it directly into
   * their markdown renderer's `onResolveLink` prop — without it, relative
   * hrefs like `./intro.md` end up fetched verbatim and 404.
   */
  onResolveLink?: (href: string, currentPath: string) => Promise<ResolveLinkResult>
}

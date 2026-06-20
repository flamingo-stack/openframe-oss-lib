"use client"

export { DocViewer } from './doc-viewer'
export type { DocViewerProps } from './doc-viewer'

export { DocsHubPage } from './docs-hub-page'
export type { DocsHubPageProps, DocumentTypeRenderers } from './docs-hub-page'

export { MarkdownSkeleton, EmbedSkeleton } from './skeletons'

export { useDocumentTree } from './use-document-tree'
export type { UseDocumentTreeConfig } from './use-document-tree'

export { useScrollSpy } from './use-scroll-spy'

export { DocNavigationProvider, useDocNavigation } from './doc-navigation-context'
export type { DocNavigator } from './doc-navigation-context'

// Re-export the doc-source types embedders need to implement the
// `/api/docs/sources/[sourceId]/{structure,content}` + `/api/resolve-link`
// API contract.
export type {
  DocNode,
  DocContent,
  DocRenderHandlers,
  DocSourceId,
  DocumentType,
  ResolveLinkResult,
} from '../../types/doc-source'

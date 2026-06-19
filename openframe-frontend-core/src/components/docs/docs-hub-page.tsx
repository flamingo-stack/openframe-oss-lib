import React from 'react'
import { DocViewer, type DocViewerProps } from './doc-viewer'
import { MarkdownSkeleton, EmbedSkeleton } from './skeletons'
import { PdfViewer } from '../embeds/pdf-viewer'
import { GoogleSheetsViewer } from '../embeds/google-sheets-viewer'
import { FigmaEmbed } from '../embeds/figma-embed'
import { FileDownloadCard } from '../embeds/file-download-card'
import type {
  DocContent,
  DocRenderHandlers,
  DocumentType,
} from '../../types/doc-source'

type DocRenderer = (content: DocContent, handlers: DocRenderHandlers) => React.ReactNode

/**
 * Per-document-type renderer map. `markdown` is required (the lib does NOT
 * ship a default markdown renderer — embedders pick their own library +
 * sanitization to avoid an XSS surface in the lib).
 *
 * `pdf` / `google_sheet` / `figma` / `file` are optional — the lib provides
 * defaults from `components/embeds`. Override only when you want different
 * props than the default (e.g. a custom PDF toolbar, embedded credentials).
 */
export type DocumentTypeRenderers = { markdown: DocRenderer } & Partial<
  Record<DocumentType, DocRenderer>
>

export interface DocsHubPageProps
  extends Omit<DocViewerProps, 'renderContent' | 'renderSkeleton' | 'showAIChat' | 'title'> {
  /** Page title. ReactNode (e.g. `<AdminPageHeader>`) or plain string
   *  (rendered with the lib's `<PageHeading>`). */
  title?: React.ReactNode

  /** Per-document-type renderer map. `markdown` is REQUIRED. */
  documentTypeRenderers: DocumentTypeRenderers

  /** Renderer for unknown / future document types. Defaults to a lib-styled
   *  "Unsupported document type" message. */
  fallbackRenderer?: DocRenderer

  /** Loading skeleton picker. Defaults: `markdown` / `undefined` →
   *  `<MarkdownSkeleton>`, everything else → `<EmbedSkeleton>`. */
  renderSkeleton?: (documentType: DocumentType | undefined) => React.ReactNode

  /** Defaults to `true` (the embeddable wrapper favors the chat-enabled
   *  experience). Only mounts the in-source RAG search bar
   *  (`<DocSearchBar>`) — does NOT require `ChatRuntimeContext`. */
  showAIChat?: boolean
}

const DEFAULT_TITLE = 'Documents'

const defaultFallbackRenderer: DocRenderer = () => (
  <div className="text-center py-16">
    <p className="text-ods-text-secondary">Unsupported document type</p>
  </div>
)

const defaultPdfRenderer: DocRenderer = (content) => (
  <PdfViewer src={content.fileUrl || ''} fileName={content.fileName} />
)

const defaultGoogleSheetRenderer: DocRenderer = (content) => (
  <GoogleSheetsViewer externalUrl={content.externalUrl || ''} fileName={content.fileName} />
)

const defaultFigmaRenderer: DocRenderer = (content) => (
  <FigmaEmbed url={content.externalUrl || ''} title={content.fileName} loading="eager" />
)

const defaultFileRenderer: DocRenderer = (content) => (
  <FileDownloadCard
    fileName={content.fileName}
    mimeType={content.mimeType}
    fileSize={content.fileSize}
    fileUrl={content.fileUrl}
  />
)

const defaultRenderSkeleton = (documentType: DocumentType | undefined) =>
  !documentType || documentType === 'markdown' ? <MarkdownSkeleton /> : <EmbedSkeleton />

/**
 * Embeddable docs-hub page. Bundles `<DocViewer>` with safe defaults so the
 * minimum embed is a one-line mount (consumer only has to supply
 * `documentTypeRenderers.markdown`).
 *
 * Used by the hub at `/knowledge-base` and `/data-room`, and by third-party
 * React apps that embed the docs experience behind their own proxy. See
 * `docs/EMBEDDING_DOCS_HUB.md` for the embedder setup.
 *
 * SEO note: this component is `'use client'` (via the docs barrel) — server-
 * side SEO is the host's responsibility. The hub's `<DocSeoContent>` is the
 * canonical implementation embedders can reference.
 */
export function DocsHubPage({
  title = DEFAULT_TITLE,
  documentTypeRenderers,
  fallbackRenderer = defaultFallbackRenderer,
  renderSkeleton = defaultRenderSkeleton,
  showAIChat = true,
  className = 'min-h-screen',
  sidebarLabel = 'DOCUMENTATION',
  ...docViewerProps
}: DocsHubPageProps) {
  const resolvedRenderers: DocumentTypeRenderers = {
    markdown: documentTypeRenderers.markdown,
    pdf: documentTypeRenderers.pdf ?? defaultPdfRenderer,
    google_sheet: documentTypeRenderers.google_sheet ?? defaultGoogleSheetRenderer,
    figma: documentTypeRenderers.figma ?? defaultFigmaRenderer,
    file: documentTypeRenderers.file ?? defaultFileRenderer,
  }

  const renderContent: DocViewerProps['renderContent'] = (content, handlers) => {
    const type = (content.documentType ?? 'markdown') as DocumentType
    const renderer = resolvedRenderers[type] ?? fallbackRenderer
    return renderer(content, handlers)
  }

  return (
    <DocViewer
      {...docViewerProps}
      title={title}
      showAIChat={showAIChat}
      className={className}
      sidebarLabel={sidebarLabel}
      renderContent={renderContent}
      renderSkeleton={renderSkeleton}
    />
  )
}

import type React from 'react';
import type { DocContent, DocRenderHandlers, DocumentType } from '../../types/doc-source';
import { FigmaEmbed } from '../embeds/figma-embed';
import { FileDownloadCard } from '../embeds/file-download-card';
import { GoogleSheetsViewer } from '../embeds/google-sheets-viewer';
import { PdfViewer } from '../embeds/pdf-viewer';
import { DocViewer, type DocViewerProps } from './doc-viewer';

type DocRenderer = (content: DocContent, handlers: DocRenderHandlers) => React.ReactNode;

/**
 * Per-document-type renderer map. `markdown` is required (the lib does NOT
 * ship a default markdown renderer — embedders pick their own library +
 * sanitization to avoid an XSS surface in the lib).
 *
 * `pdf` / `google_sheet` / `figma` / `file` are optional — the lib provides
 * defaults from `components/embeds`. Override only when you want different
 * props than the default (e.g. a custom PDF toolbar, embedded credentials).
 */
export type DocumentTypeRenderers = { markdown: DocRenderer } & Partial<Record<DocumentType, DocRenderer>>;

export interface DocsHubPageProps extends Omit<DocViewerProps, 'renderContent' | 'showAIChat'> {
  /** Per-document-type renderer map. `markdown` is REQUIRED. */
  documentTypeRenderers: DocumentTypeRenderers;

  /** Renderer for unknown / future document types. Defaults to a lib-styled
   *  "Unsupported document type" message. */
  fallbackRenderer?: DocRenderer;

  /** Defaults to `true` (the embeddable wrapper favors the chat-enabled
   *  experience). Only mounts the in-source RAG search bar
   *  (`<DocSearchBar>`) — does NOT require `ChatRuntimeContext`. */
  showAIChat?: boolean;
}

const DEFAULT_TITLE = 'Documents';

const defaultFallbackRenderer: DocRenderer = () => (
  <div className="py-16 text-center">
    <p className="text-ods-text-secondary">Unsupported document type</p>
  </div>
);

// Each viewer owns both its states without a document: in a loading scope (the document is being read) it draws its
// own loading form, otherwise its "not available" state when the DAL left the URL empty. So the renderers always
// render the viewer, and the viewer never mounts a frame without a source.
const defaultPdfRenderer: DocRenderer = content => (
  <PdfViewer src={content.fileUrl ?? ''} fileName={content.fileName} />
);

const defaultGoogleSheetRenderer: DocRenderer = content => (
  <GoogleSheetsViewer externalUrl={content.externalUrl ?? ''} fileName={content.fileName} />
);

const defaultFigmaRenderer: DocRenderer = content => (
  <FigmaEmbed url={content.externalUrl ?? ''} title={content.fileName} loading="eager" />
);

const defaultFileRenderer: DocRenderer = content => (
  <FileDownloadCard
    fileName={content.fileName}
    mimeType={content.mimeType}
    fileSize={content.fileSize}
    fileUrl={content.fileUrl}
  />
);

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
  };

  const renderContent: DocViewerProps['renderContent'] = (content, handlers) => {
    const type = content.documentType ?? 'markdown';
    const renderer = resolvedRenderers[type] ?? fallbackRenderer;
    return renderer(content, handlers);
  };

  return (
    <DocViewer
      {...docViewerProps}
      title={title}
      showAIChat={showAIChat}
      className={className}
      sidebarLabel={sidebarLabel}
      renderContent={renderContent}
    />
  );
}

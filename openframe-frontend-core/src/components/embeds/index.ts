export { EmbedIframe } from './embed-iframe'
export type { EmbedIframeProps } from './embed-iframe'

export { PdfViewer } from './pdf-viewer'
export type { PdfViewerProps } from './pdf-viewer'

export { GoogleSheetsViewer } from './google-sheets-viewer'
export type { GoogleSheetsViewerProps } from './google-sheets-viewer'

export { FigmaEmbed } from './figma-embed'
export type { FigmaEmbedProps } from './figma-embed'

export { OGLinkPreview, OGLinkErrorBoundary } from './og-link-preview'
export type {
  OGLinkPreviewProps,
  OGData,
  BuildPlaceholderUrl,
} from './og-link-preview'

export { FileDownloadCard } from './file-download-card'
export type { FileDownloadCardProps } from './file-download-card'

// Satellite embeds wired into `<RichMarkdownRenderer>` (`components/ui`).
// Exported individually so embedders can compose them outside the renderer
// (e.g. a release page that wants a single reddit card without parsing
// markdown). The runtime knobs (proxy endpoints, image transformer) are
// shared via `RichMarkdownRuntimeProvider` — call sites that mount a
// satellite directly should wrap with the provider when they need
// overrides; otherwise the defaults match the hub's existing endpoints.
export { RedditEmbedClient } from './reddit-embed-client'
export { TwitterEmbedClient } from './twitter-embed-client'
export { LinkedInEmbedClient } from './linkedin-embed-client'
export { MarkdownImage } from './markdown-image'
export {
  EmbedContainer,
  YouTubeContainer,
  TwitterContainer,
  RedditContainer,
  LinkPreviewContainer,
  LinkedInContainer,
  EMBED_SIZES,
  type EmbedSize,
} from './embed-container'
export {
  RichMarkdownRuntimeProvider,
  useRichMarkdownRuntime,
  type RichMarkdownRuntime,
} from './rich-markdown-runtime'

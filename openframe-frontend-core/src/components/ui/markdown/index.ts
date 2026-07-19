/**
 * Unified markdown module — public surface.
 *
 * ONE engine (`MarkdownEngine`), two named compositions:
 *   - `SimpleMarkdownRenderer` — chat/doc surfaces (embed-free bundle)
 *   - `RichMarkdownRenderer`   — authored-content surfaces (shortcodes,
 *     social embeds, Video SSOT, OG previews)
 */
export { MarkdownEngine, type MarkdownEngineProps } from './engine';
export {
  SimpleMarkdownRenderer,
  type SimpleMarkdownRendererProps,
  type ResolveLinkResult,
} from './simple-markdown-renderer';
export {
  RichMarkdownRenderer,
  type RichMarkdownRendererProps,
} from './rich/rich-markdown-renderer';
export { processShortcodes } from './rich/shortcodes';
export {
  SAFE_HTML_TAGS,
  buildEffectiveTagSet,
  buildSanitizeSchema,
  cardAwareUrlTransform,
  escapeUnknownHtmlTags,
  rehypeStripUnsafe,
  isImageSrcAllowed,
  type MarkdownUrlPolicy,
} from './sanitize';
export {
  TEXT_SIZE_PRESETS,
  resolveTextSizeConfig,
  type TextSizeConfig,
  type TextSizeClassMap,
  type TextSizeElement,
  type TextSizePreset,
} from './text-size';
export { MermaidDiagram, mermaidStyles } from './mermaid-diagram';
export { useHeadingIdGenerator, extractText, type HeadingSection } from './heading-ids';
export { splitStreamingBlocks, completeStreamingTail, type StreamingBlock } from './streaming';

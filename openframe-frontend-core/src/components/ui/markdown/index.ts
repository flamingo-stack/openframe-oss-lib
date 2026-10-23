/**
 * Unified markdown module — public surface.
 *
 * ONE engine (`MarkdownEngine`), two named compositions:
 *   - `SimpleMarkdownRenderer` — chat/doc surfaces (embed-free bundle)
 *   - `RichMarkdownRenderer`   — authored-content surfaces (shortcodes,
 *     social embeds, Video SSOT, OG previews)
 */
export { MARKDOWN_H1_CLASS, MARKDOWN_H2_CLASS, MARKDOWN_PARAGRAPH_CLASS } from './base-components';
export { MarkdownEngine, MarkdownEngineSkeleton, MARKDOWN_SKELETON_LINES, type MarkdownEngineProps } from './engine';
export { SimpleMarkdownRenderer, type SimpleMarkdownRendererProps } from './simple-markdown-renderer';
export { type ResolveLinkResult } from '../../../types/doc-source';
export { RichMarkdownRenderer, type RichMarkdownRendererProps } from './rich/rich-markdown-renderer';
export { processShortcodes } from './rich/shortcodes';
export {
  SAFE_HTML_TAGS,
  SVG_TAGS,
  buildEffectiveTagSet,
  buildSanitizeSchema,
  cardAwareUrlTransform,
  escapeUnknownHtmlTags,
  rehypeStripUnsafe,
} from './sanitize';
export {
  TEXT_SIZE_PRESETS,
  resolveTextSizeConfig,
  type TextSizeConfig,
  type TextSizeClassMap,
  type TextSizeElement,
  type TextSizePreset,
} from './text-size';
export { MermaidDiagram } from './mermaid-diagram';
export { buildHeadingIdMap, useHeadingIdMap, extractText, type HeadingSection, type HeadingIdMap } from './heading-ids';
// NOT exported: `mermaidStyles` (single-consumer, owned by MermaidDiagram)
// and `buildStandardLeafRenderers` (an internal SSOT — exporting it invites
// exactly the renderer-map fork this module exists to prevent; the rich
// composition imports it directly from ./base-components).
export { splitStreamingBlocks, completeStreamingTail, type StreamingBlock } from './streaming';

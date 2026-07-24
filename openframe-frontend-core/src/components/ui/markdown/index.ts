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
export {
  buildHeadingIdMap,
  useHeadingIdMap,
  extractText,
  type HeadingSection,
  type HeadingIdMap,
} from './heading-ids';
// NOT exported: `mermaidStyles` (single-consumer, owned by MermaidDiagram)
// and `buildStandardLeafRenderers` (an internal SSOT — exporting it invites
// exactly the renderer-map fork this module exists to prevent; the rich
// composition imports it directly from ./base-components).
export { splitStreamingBlocks, completeStreamingTail, type StreamingBlock } from './streaming';

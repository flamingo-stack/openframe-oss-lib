"use client";

/**
 * MarkdownEngine — THE one react-markdown pipeline for every surface
 * (chat messages, blog, docs, KB articles, legal, releases, admin previews).
 *
 * `SimpleMarkdownRenderer` and `RichMarkdownRenderer` are thin compositions
 * over this engine (see ./simple-markdown-renderer.tsx and ./rich/) — there
 * is exactly ONE parse path, ONE sanitizer stack, ONE mermaid, ONE
 * heading-id algorithm, ONE link-click model. Do not fork this pipeline;
 * extend via `componentOverrides` / `additionalRemarkPlugins` /
 * `preprocessContent` / `extraAllowedHtmlTags`.
 *
 * Pipeline order (each stage documented in ./sanitize.ts):
 *   preprocessContent (composition hook, e.g. shortcodes)
 *   → escapeUnknownHtmlTags (text pre-pass, React 19 crash guard)
 *   → remark: remarkGfm, remarkBreaks, ...additionalRemarkPlugins
 *   → rehype: rehypeRaw → rehypeSanitize(schema) → rehypeStripUnsafe
 *       → rehypeHighlight
 *   → urlTransform: cardAwareUrlTransform
 *   → components: buildBaseComponents(...) spread-last componentOverrides
 */
import React, { memo, useMemo, useRef } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import type { PluggableList } from 'unified';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import type { ResolveLinkResult } from '../../../types/doc-source';
import {
  buildEffectiveTagSet,
  buildSanitizeSchema,
  cardAwareUrlTransform,
  escapeUnknownHtmlTags,
  rehypeStripUnsafe,
  type MarkdownUrlPolicy,
} from './sanitize';
import { resolveTextSizeConfig, type TextSizeConfig } from './text-size';
import { useHeadingIdGenerator, type HeadingSection } from './heading-ids';
import { buildBaseComponents } from './base-components';
import { mermaidStyles } from './mermaid-diagram';
import { completeStreamingTail, splitStreamingBlocks } from './streaming';

export type { ResolveLinkResult };

export interface MarkdownEngineProps {
  content: string;
  className?: string;
  /** Backend-provided heading IDs for deep-link anchors */
  sectionIds?: HeadingSection[];
  /** When the page already has an H1, render markdown `#` as `<h2>` */
  demoteMarkdownH1ToH2?: boolean;
  /** List of broken link hrefs detected server-side (shown with [BROKEN] badge) */
  brokenLinks?: string[];
  /** Callback for internal (non-http, non-anchor) link clicks */
  onInternalLinkClick?: (path: string, options?: { expandFolder?: boolean; fromInternalLink?: boolean }) => void;
  /** Current documentation path — enables internal-link mode when set */
  currentPath?: string;
  /** Resolve an internal link href to a navigation path. */
  onResolveLink?: (href: string, currentPath: string) => Promise<ResolveLinkResult>;
  /** Pre-process the raw markdown string before rendering (e.g. shortcode expansion) */
  preprocessContent?: (content: string) => string;
  /** Merge additional or override react-markdown component renderers (spread LAST — caller wins) */
  componentOverrides?: Partial<Components>;
  /** Extra remark plugins appended after the built-in remarkGfm + remarkBreaks */
  additionalRemarkPlugins?: PluggableList;
  /** Text sizing preset / per-element overrides */
  textSize?: TextSizeConfig;
  /**
   * Extra raw-HTML tags this composition admits. Unioned into BOTH the
   * text pre-pass allowlist AND the sanitize schema together (the
   * coupled-allowlist invariant — see ./sanitize.ts).
   */
  extraAllowedHtmlTags?: string[];
  /** LLM-surface URL policy (image-origin allowlist). Omit = allow all. */
  urlPolicy?: MarkdownUrlPolicy;
  /**
   * Set true for the actively streaming message ONLY. Enables atomic-block
   * memoization + fence tail-completion + an aria-live wrapper. The caller
   * MUST flip back to false on completion — that final render is one
   * authoritative whole-document parse (block cache discarded), so
   * streaming can never permanently diverge from the settled output.
   */
  streaming?: boolean;
}

/**
 * One memoized completed block of a streaming message. Parent-level memos
 * keep every prop except `text` referentially stable, so a completed block
 * re-renders only if its own text changes (i.e. the splitter re-cut).
 * React key = position index — identical blocks at different positions
 * never alias (see ./streaming.ts).
 */
const StreamingBlockRenderer = memo(function StreamingBlockRenderer({
  text,
  remarkPlugins,
  rehypePlugins,
  components,
}: {
  text: string;
  remarkPlugins: PluggableList;
  rehypePlugins: PluggableList;
  components: Components;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      urlTransform={cardAwareUrlTransform}
      components={components}
    >
      {text}
    </ReactMarkdown>
  );
});

const MarkdownEngineImpl: React.FC<MarkdownEngineProps> = ({
  content,
  className = '',
  sectionIds,
  demoteMarkdownH1ToH2 = false,
  brokenLinks = [],
  onInternalLinkClick,
  currentPath,
  onResolveLink,
  preprocessContent,
  componentOverrides,
  additionalRemarkPlugins,
  textSize,
  extraAllowedHtmlTags,
  urlPolicy,
  streaming = false,
}) => {
  const textSizes = useMemo(() => resolveTextSizeConfig(textSize), [textSize]);
  const generateHeadingId = useHeadingIdGenerator(sectionIds);

  // Effective tag allowlist — shared source for pre-pass AND schema.
  const effectiveTags = useMemo(
    () => buildEffectiveTagSet(extraAllowedHtmlTags),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [extraAllowedHtmlTags?.join('|')],
  );

  const processedContent = useMemo(() => {
    const preprocessed = preprocessContent ? preprocessContent(content) : content;
    const escaped = escapeUnknownHtmlTags(preprocessed, effectiveTags);
    return streaming ? completeStreamingTail(escaped) : escaped;
  }, [preprocessContent, content, effectiveTags, streaming]);

  const remarkPlugins = useMemo<PluggableList>(
    () => [remarkGfm, remarkBreaks, ...(additionalRemarkPlugins ?? [])],
    [additionalRemarkPlugins],
  );

  const rehypePlugins = useMemo<PluggableList>(() => {
    const schema = buildSanitizeSchema({ extraAllowedHtmlTags });
    return [
      // ORDER MATTERS: rehype-raw parses embedded raw HTML into HAST;
      // rehypeSanitize is the allow-list boundary; rehypeStripUnsafe is
      // defense-in-depth (srcset scanning, iframe[srcdoc]); highlight last.
      rehypeRaw,
      [rehypeSanitize, schema],
      rehypeStripUnsafe,
      [rehypeHighlight, { detect: true, ignoreMissing: true }],
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraAllowedHtmlTags?.join('|')]);

  const components: Components = useMemo(
    () => ({
      ...buildBaseComponents({
        textSizes,
        generateHeadingId,
        demoteMarkdownH1ToH2,
        brokenLinks,
        currentPath,
        onInternalLinkClick,
        onResolveLink,
        urlPolicy,
      }),
      // Caller overrides spread LAST — chat's card/mention <a> override,
      // rich's embed overrides, etc. always win over the base map.
      ...componentOverrides,
    }),
    [
      textSizes,
      generateHeadingId,
      demoteMarkdownH1ToH2,
      brokenLinks,
      currentPath,
      onInternalLinkClick,
      onResolveLink,
      urlPolicy,
      componentOverrides,
    ],
  );

  // Streaming block plan (only computed on the streaming path).
  const streamingBlocks = useMemo(
    () => (streaming ? splitStreamingBlocks(processedContent) : null),
    [streaming, processedContent],
  );

  // Track render epochs for non-memoizable content so keys stay stable
  // by position across re-cuts.
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const body = streamingBlocks ? (
    // aria-live: readers announce coherent appended chunks, not per-token
    // spam (polite + additions). Streaming caret/pulse affordances live in
    // chat components and honor prefers-reduced-motion there.
    <div aria-live="polite" aria-relevant="additions text" ref={bodyRef}>
      {streamingBlocks.map((block) =>
        block.memoizable ? (
          <StreamingBlockRenderer
            key={block.index}
            text={block.text}
            remarkPlugins={remarkPlugins}
            rehypePlugins={rehypePlugins}
            components={components}
          />
        ) : (
          <ReactMarkdown
            key={block.index}
            remarkPlugins={remarkPlugins}
            rehypePlugins={rehypePlugins}
            urlTransform={cardAwareUrlTransform}
            components={components}
          >
            {block.text}
          </ReactMarkdown>
        ),
      )}
    </div>
  ) : (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      urlTransform={cardAwareUrlTransform}
      components={components}
    >
      {processedContent}
    </ReactMarkdown>
  );

  return (
    <div className={`simple-markdown-renderer ${className}`}>
      <style dangerouslySetInnerHTML={{ __html: mermaidStyles }} />
      {/* `overflow-wrap: anywhere` is inherited from `.simple-markdown-renderer`
          in app-globals.css — do NOT re-add `break-words` here, it would
          override the cascade with the weaker `break-word` for this subtree. */}
      <div className="content-wrapper max-w-none">
        <article className="prose prose-lg max-w-none">{body}</article>
      </div>
    </div>
  );
};

/**
 * Memoized so a parent re-render with UNCHANGED props (same `content`
 * string, same memoized `componentOverrides`/plugins) does NOT re-parse the
 * markdown. Re-parsing rebuilds the entire react-markdown subtree, which
 * RE-MOUNTS any embedded inline entity cards — closing their open menus and
 * re-triggering their fetch on every chat re-render (streaming chunk AND
 * scroll). With stable props the renderer bails, so completed messages'
 * cards stay mounted. The streaming path additionally memoizes completed
 * atomic blocks so the in-flight message re-parses only its live tail.
 */
export const MarkdownEngine = memo(MarkdownEngineImpl);

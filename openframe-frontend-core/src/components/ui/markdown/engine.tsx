'use client';

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
 *   → completeStreamingTail (streaming only — MUST precede the escape pass)
 *   → escapeUnknownHtmlTags (text pre-pass, React 19 crash guard)
 *   → remark: remarkGfm, remarkBreaks, ...additionalRemarkPlugins
 *   → rehype: rehypeRaw → rehypeSanitize(schema) → rehypeStripUnsafe
 *       → rehypeLabelBareFences → rehypeHighlight (not on the streaming tail)
 *   → urlTransform: cardAwareUrlTransform
 *   → components: buildBaseComponents(...) spread-last componentOverrides
 */

import type { Element, Root } from 'hast';
import type React from 'react';
import { memo, useEffect, useMemo, useSyncExternalStore } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import type RehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import type { PluggableList } from 'unified';
import type { ResolveLinkResult } from '../../../types/doc-source';
import { readAppOrigins, SERVER_APP_ORIGINS, subscribeAppOrigins } from '../../../utils/app-origins';
import { cn } from '../../../utils/cn';
import { TextLineSkeleton } from '../../loading/unified-skeleton';
import { LoadingItems, useLoadingScope } from '../loading-scope';
import { buildBaseComponents, MARKDOWN_H1_CLASS, MARKDOWN_H2_CLASS, MARKDOWN_PARAGRAPH_CLASS } from './base-components';
import { MarkdownMediaOriginsContext } from './external-media-gate';
import { HeadingIdMapContext, HeadingLineOffsetContext, useHeadingIdMap, type HeadingSection } from './heading-ids';
import {
  buildEffectiveTagSet,
  buildSanitizeSchema,
  cardAwareUrlTransform,
  escapeUnknownHtmlTags,
  rehypeStripUnsafe,
} from './sanitize';
import { completeStreamingTail, splitStreamingBlocks } from './streaming';
import { resolveTextSizeConfig, type TextSizeConfig } from './text-size';

/**
 * Module-scope empty default for `brokenLinks`.
 *
 * A `brokenLinks = []` DEFAULT PARAMETER allocates a fresh array on every
 * render, so the `components` useMemo (which lists it as a dep) recomputed
 * every render, which changed `StreamingBlockRenderer`'s `components` prop
 * identity, which made its `memo` bail EVERY time — every completed block
 * re-parsed on every streamed token, defeating the entire atomic-block
 * optimization. Any new default that is an object/array/function MUST be
 * hoisted here for the same reason.
 *
 * Exported so the compositions that apply the SAME default before handing
 * props down (rich) share this ONE identity instead of declaring a second
 * module-scope empty array with a copy of this rationale. Deliberately NOT
 * re-exported from ./index — it is an internal identity contract between the
 * engine and its compositions, not public API.
 */
export const NO_BROKEN_LINKS: readonly string[] = [];

const BARE_FENCE_LANGUAGE = 'code';

// The code highlighter (rehype-highlight and its grammars) is the heaviest part
// of the renderer, and most text has no code in it. It is fetched the first time
// a text with a code block is drawn, once per page; until it lands that block is
// drawn unhighlighted, the way the streaming tail already is.
type HighlightPlugin = typeof RehypeHighlight;
let highlightPlugin: HighlightPlugin | null = null;
let highlightRequest: Promise<void> | null = null;
const highlightListeners = new Set<() => void>();

function loadHighlightPlugin(): void {
  highlightRequest ??= import('rehype-highlight')
    .then(module => {
      highlightPlugin = module.default;
      for (const listener of highlightListeners) listener();
    })
    .catch(() => {
      // A failed fetch leaves code unhighlighted; the next text with code asks again.
      highlightRequest = null;
    });
}

function subscribeToHighlightPlugin(listener: () => void): () => void {
  highlightListeners.add(listener);
  return () => {
    highlightListeners.delete(listener);
  };
}

/** A fenced block or inline HTML code: the only things the highlighter colours. */
const HAS_CODE_BLOCK = /```|~~~|<pre[\s>]|<code[\s>]/;

/** The highlighter once it has loaded, asked for only when `content` has code to colour. */
function useHighlightPlugin(content: string): HighlightPlugin | null {
  const wanted = HAS_CODE_BLOCK.test(content);
  const plugin = useSyncExternalStore(
    subscribeToHighlightPlugin,
    () => highlightPlugin,
    () => null,
  );
  useEffect(() => {
    if (wanted) loadHighlightPlugin();
  }, [wanted]);
  return wanted ? plugin : null;
}

/**
 * Gives a fenced code block written without a language the `language-code`
 * class. The `code` renderer tells a fenced block from inline code only by a
 * `language-*` class, which unlabelled fences used to get from
 * rehype-highlight's language detection; without detection (and on the
 * streaming tail, which is not highlighted at all) they would render as
 * inline-code pills. `code` is in rehype-highlight's `plainText` list, so
 * the block is left unhighlighted, and its header reads "code".
 */
function rehypeLabelBareFences() {
  const visit = (node: Root | Element) => {
    for (const child of node.children) {
      if (child.type !== 'element') continue;
      if (child.tagName === 'pre') {
        for (const code of child.children) {
          if (code.type !== 'element' || code.tagName !== 'code') continue;
          const classes = Array.isArray(code.properties.className) ? code.properties.className : [];
          if (!classes.some(c => String(c).startsWith('language-'))) {
            code.properties.className = [...classes, `language-${BARE_FENCE_LANGUAGE}`];
          }
        }
      }
      visit(child);
    }
  };
  return (tree: Root) => visit(tree);
}

export interface MarkdownEngineProps {
  content: string;
  className?: string;
  /** Backend-provided heading IDs for deep-link anchors */
  sectionIds?: HeadingSection[];
  /** When the page already has an H1, render markdown `#` as `<h2>` */
  demoteMarkdownH1ToH2?: boolean;
  /** List of broken link hrefs detected server-side (shown with [BROKEN] badge) */
  brokenLinks?: readonly string[];
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
  /**
   * Let images and other media load from any origin. Off (the default), they
   * load only from the app itself: the content is treated as untrusted, and a
   * third-party image URL leaks whatever it carries the moment it renders. See
   * `RehypeStripUnsafeOptions` in ./sanitize.ts.
   */
  allowRemoteMedia?: boolean;
  /**
   * Set true for the actively streaming message ONLY. Enables atomic-block
   * memoization + fence tail-completion + an aria-live wrapper. The caller
   * MUST flip back to false on completion — that final render is one
   * authoritative whole-document parse (block cache discarded), so
   * streaming can never permanently diverge from the settled output.
   */
  streaming?: boolean;
  /**
   * The shape drawn while the content is read (a page's loading state, where `content` is empty): this many
   * sections, each a heading and its paragraphs. Unset, one paragraph of `skeletonLines` lines.
   */
  skeletonSections?: number;
  /** Lines of the one paragraph a loading body draws when it names no sections. Default 3. */
  skeletonLines?: number;
  /** A loading body opens with its own `# ` title (a legal document's): its title row is drawn first. */
  skeletonTitle?: boolean;
  /** The content is still being read: the body draws its skeleton (the `skeleton*` shape). A loading scope does the
   *  same while `content` is empty. */
  loading?: boolean;
}

/** Lines a loading body draws when its caller names no shape. */
export const MARKDOWN_SKELETON_LINES = 3;
/** Paragraphs under each heading of a loading body, and their lines. */
const SKELETON_SECTION_PARAGRAPHS = [3, 2] as const;
/**
 * Lines a typical body's opening line set takes, on a phone (below `content-md`) and from `content-md`: a document's
 * `# ` title wraps on a phone, and the opening paragraph every post and legal document starts with runs a few lines.
 * Typical lengths, never one record's: a longer record growing past them is a settle below its own lines.
 */
const SKELETON_TITLE_LINES = { phone: 2, wide: 1 } as const;
const SKELETON_LEAD_LINES = { phone: 5, wide: 3 } as const;
/** The renderer's own frame: read by the engine and by its skeleton. */
/** The renderer's root class, on the rendered document and on every skeleton of one: it names a markdown body. */
export const MARKDOWN_RENDERER_CLASS = 'simple-markdown-renderer';
const RENDERER_CLASS = MARKDOWN_RENDERER_CLASS;
const CONTENT_WRAPPER_CLASS = 'content-wrapper max-w-none';
/**
 * The rendered body. `[&>*:last-child]:mb-0`: the last block never pushes what follows the document further down.
 * Prose's own last-child reset has zero specificity, so a block that sets its own margin (a table's `my-6`) kept it,
 * and a document's distance to the next section depended on which block it ended with.
 */
const ARTICLE_CLASS = 'prose prose-lg max-w-none [&>*:last-child]:mb-0';

/**
 * One memoized completed block of a streaming message. Parent-level memos
 * keep every prop except `text` referentially stable, so a completed block
 * re-renders only if its own text changes (i.e. the splitter re-cut).
 * React key = position index — identical blocks at different positions
 * never alias (see ./streaming.ts).
 */
const StreamingBlockRenderer = memo(function StreamingBlockRendererImpl({
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
  brokenLinks = NO_BROKEN_LINKS,
  onInternalLinkClick,
  currentPath,
  onResolveLink,
  preprocessContent,
  componentOverrides,
  additionalRemarkPlugins,
  textSize,
  extraAllowedHtmlTags,
  allowRemoteMedia = false,
  streaming = false,
}) => {
  const textSizes = useMemo(() => resolveTextSizeConfig(textSize), [textSize]);

  // Stable identity key for the caller's tag array — a fresh array with the
  // same contents must not bust these memos.
  const extraTagsKey = extraAllowedHtmlTags?.join('|') ?? '';

  // Effective tag allowlist — shared source for pre-pass AND schema.
  // Both memos consume ONLY `extraTagsKey`, so the dep list is honest and
  // needs no eslint suppression.
  const effectiveTags = useMemo(
    () => buildEffectiveTagSet(extraTagsKey ? extraTagsKey.split('|') : undefined),
    [extraTagsKey],
  );

  const processedContent = useMemo(() => {
    const preprocessed = preprocessContent ? preprocessContent(content) : content;
    // ORDER IS LOAD-BEARING: complete the streaming tail FIRST, then escape.
    //
    // Escaping first failed OPEN on the most common streaming shape. During a
    // stream every partially-emitted fence is unclosed, and both of the
    // pre-pass's fence notions (`PROTECTED_SPAN_RE` for the carve AND the
    // mask) only recognize CLOSED fences — so a `</textarea>` inside the
    // still-open fence satisfied "is closed later", the prose opener above it
    // stayed live, and parse5 swallowed the rest of the message until the
    // fence closed (an LLM explaining `<textarea>` then streaming a fenced
    // HTML sample hits this exactly). The same ordering also fired the carve's
    // documented "unclosed fence body is escaped" tradeoff on EVERY streaming
    // frame, so a `<their>` mid-fence rendered as `&lt;their&gt;` until the
    // closer arrived.
    //
    // `completeStreamingTail` only APPENDS a fence delimiter run, so escaping
    // afterwards is safe (nothing it adds is escapable).
    const completed = streaming ? completeStreamingTail(preprocessed) : preprocessed;
    return escapeUnknownHtmlTags(completed, effectiveTags);
  }, [preprocessContent, content, effectiveTags, streaming]);

  // Heading ids: derived ONCE from the processed source, never from render
  // order. See ./heading-ids.ts for why the old stateful generator was
  // unsound under block memoization AND StrictMode.
  const headingIds = useHeadingIdMap(processedContent, sectionIds);

  const remarkPlugins = useMemo<PluggableList>(
    () => [remarkGfm, remarkBreaks, ...(additionalRemarkPlugins ?? [])],
    [additionalRemarkPlugins],
  );

  // What "from the app" means for media: the server's answer while hydrating (only relative URLs), the page's own and
  // the host's sanctioned origins after that, and again whenever a host registers its auth adapter later.
  const appOrigins = useSyncExternalStore(subscribeAppOrigins, readAppOrigins, () => SERVER_APP_ORIGINS);

  const rehypeHighlight = useHighlightPlugin(processedContent);
  const { rehypePlugins, liveRehypePlugins } = useMemo(() => {
    const schema = buildSanitizeSchema({
      extraAllowedHtmlTags: extraTagsKey ? extraTagsKey.split('|') : undefined,
    });
    // ORDER MATTERS: rehype-raw parses embedded raw HTML into HAST;
    // rehypeSanitize is the allow-list boundary; rehypeStripUnsafe is
    // defense-in-depth (srcset scanning, iframe[srcdoc]) and drops media from
    // outside the app; the fence label goes on after sanitizing and before
    // highlight, which runs last.
    const safe: PluggableList = [
      rehypeRaw,
      [rehypeSanitize, schema],
      [rehypeStripUnsafe, { allowRemoteMedia, appOrigins }],
      rehypeLabelBareFences,
    ];
    // No language detection: it ran highlightAuto over every registered
    // grammar for each unlabelled fence (~2.5x the cost of opening a
    // thread) and often guessed wrong (PowerShell shown as "VBNET").
    const highlighted: PluggableList = rehypeHighlight
      ? [...safe, [rehypeHighlight, { plainText: [BARE_FENCE_LANGUAGE] }]]
      : safe;
    return {
      rehypePlugins: highlighted,
      // The streaming tail re-parses on every chunk, and a code fence being
      // typed is one tail block — highlighting it every chunk was the
      // costliest step of a streamed reply. It is highlighted once it
      // completes: every block before the tail and the final parse use
      // `rehypePlugins`.
      liveRehypePlugins: safe,
    };
  }, [extraTagsKey, allowRemoteMedia, appOrigins, rehypeHighlight]);

  const components: Components = useMemo(
    () => ({
      ...buildBaseComponents({
        textSizes,
        demoteMarkdownH1ToH2,
        brokenLinks,
        currentPath,
        onInternalLinkClick,
        onResolveLink,
      }),
      // Caller overrides spread LAST — chat's card/mention <a> override,
      // rich's embed overrides, etc. always win over the base map.
      ...componentOverrides,
    }),
    [textSizes, demoteMarkdownH1ToH2, brokenLinks, currentPath, onInternalLinkClick, onResolveLink, componentOverrides],
  );

  // Streaming block plan (only computed on the streaming path).
  const streamingBlocks = useMemo(
    () => (streaming ? splitStreamingBlocks(processedContent) : null),
    [streaming, processedContent],
  );

  const body = streamingBlocks ? (
    // aria-live: readers announce coherent appended chunks, not per-token
    // spam (polite + additions). Streaming caret/pulse affordances live in
    // chat components and honor prefers-reduced-motion there.
    <div aria-live="polite" aria-relevant="additions text">
      {streamingBlocks.map((block, i) => (
        // Each unit is parsed on its own, so hast positions restart at 1;
        // the offset maps them back onto the document-wide heading-id map.
        <HeadingLineOffsetContext.Provider key={block.index} value={block.startLine - 1}>
          {block.memoizable ? (
            <StreamingBlockRenderer
              text={block.text}
              remarkPlugins={remarkPlugins}
              rehypePlugins={rehypePlugins}
              components={components}
            />
          ) : (
            <ReactMarkdown
              remarkPlugins={remarkPlugins}
              rehypePlugins={i === streamingBlocks.length - 1 ? liveRehypePlugins : rehypePlugins}
              urlTransform={cardAwareUrlTransform}
              components={components}
            >
              {block.text}
            </ReactMarkdown>
          )}
        </HeadingLineOffsetContext.Provider>
      ))}
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
    <div className={`${RENDERER_CLASS} ${className}`}>
      {/* Mermaid's <style> is rendered by MermaidDiagram itself — one tag
          per mounted diagram instead of one per engine instance (i.e. per
          chat segment), where the overwhelming majority render no diagram. */}
      {/* `overflow-wrap: anywhere` is inherited from `.simple-markdown-renderer`
          in app-globals.css — do NOT re-add `break-words` here, it would
          override the cascade with the weaker `break-word` for this subtree. */}
      <div className={CONTENT_WRAPPER_CLASS}>
        <article className={ARTICLE_CLASS}>
          <HeadingIdMapContext.Provider value={headingIds}>
            <MarkdownMediaOriginsContext.Provider value={allowRemoteMedia ? null : appOrigins}>
              {body}
            </MarkdownMediaOriginsContext.Provider>
          </HeadingIdMapContext.Provider>
        </article>
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
export const MarkdownEngine = memo(function MarkdownEngineGate(props: MarkdownEngineProps) {
  // In a page's loading state with no content yet (it is read) the body is its skeleton; content it is given
  // there is the page's own and renders as it is.
  const inScope = useLoadingScope();
  if ((inScope && !props.content) || props.loading) {
    return (
      <MarkdownEngineSkeleton
        sections={props.skeletonSections}
        lines={props.skeletonLines}
        title={props.skeletonTitle}
        textSize={props.textSize}
        className={props.className}
      />
    );
  }
  return <MarkdownEngineImpl {...props} />;
});

/** A paragraph of `lines` lines at the body's own paragraph type, as one bar of its line height. */
function ParagraphBar({ lines, className }: { lines: number; className: string }) {
  return (
    <div className={className}>
      <TextLineSkeleton type="inherit" lines={lines} className="w-full" />
    </div>
  );
}

/** Lines of a text run per breakpoint: on a phone, and from `content-md`. */
interface SkeletonLinesByBreakpoint {
  phone: number;
  wide: number;
}

/** A text run of the lines it takes on a phone and from `content-md` (the content area's own steps). */
function LinesByBreakpoint({ lines, as = 'div' }: { lines: SkeletonLinesByBreakpoint; as?: 'div' | 'span' }) {
  return (
    <>
      <TextLineSkeleton type="inherit" as={as} lines={lines.phone} className="w-full content-md:hidden" />
      <TextLineSkeleton type="inherit" as={as} lines={lines.wide} className="hidden w-full content-md:flex" />
    </>
  );
}

/**
 * A markdown body while it is read: the renderer's own frame and type. With `sections`, the body's opening paragraph
 * (a typical length per breakpoint), then each section a REAL `<h2>` (the renderer's heading classes) holding a bar,
 * then its paragraphs; without, one paragraph of `lines` lines. Every bar takes the line height of the element it
 * stands for, at the body's text size.
 */
export function MarkdownEngineSkeleton({
  sections,
  lines = MARKDOWN_SKELETON_LINES,
  textSize,
  title = false,
  className = '',
}: {
  sections?: number;
  lines?: number;
  textSize?: TextSizeConfig;
  /** The body opens with its own `# ` title (a legal document's, demoted to an `h2`): its H1 row is drawn first. */
  title?: boolean;
  className?: string;
}) {
  const textSizes = resolveTextSizeConfig(textSize);
  const paragraphClass = cn(MARKDOWN_PARAGRAPH_CLASS, textSizes.p);
  return (
    // `w-full`: bars have no width of their own, so in a shrink-to-fit parent (a flex item) the skeleton would be
    // 0px wide where the loaded text fills its line.
    <div className={`${RENDERER_CLASS} w-full ${className}`} aria-hidden>
      <div className={CONTENT_WRAPPER_CLASS}>
        <div className={ARTICLE_CLASS}>
          {title && (
            <h2 className={cn(MARKDOWN_H1_CLASS, textSizes.h1)}>
              <LinesByBreakpoint lines={SKELETON_TITLE_LINES} as="span" />
            </h2>
          )}
          {sections ? (
            <div className={paragraphClass}>
              <LinesByBreakpoint lines={SKELETON_LEAD_LINES} />
            </div>
          ) : null}
          {sections ? (
            // loading-standard-ok(ITEM_MARK): a document's sections are its markdown text; the loaded body has no items to mark
            <LoadingItems count={sections}>
              {() => (
                <div>
                  <h2 className={cn(MARKDOWN_H2_CLASS, textSizes.h2)}>
                    <TextLineSkeleton type="inherit" as="span" className="w-1/2" />
                  </h2>
                  {SKELETON_SECTION_PARAGRAPHS.map((paragraphLines, index) => (
                    <ParagraphBar key={index} lines={paragraphLines} className={paragraphClass} />
                  ))}
                </div>
              )}
            </LoadingItems>
          ) : (
            <ParagraphBar lines={lines} className={paragraphClass} />
          )}
        </div>
      </div>
    </div>
  );
}

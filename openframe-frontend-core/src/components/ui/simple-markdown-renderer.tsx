"use client";

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import ReactMarkdown, { type Components, defaultUrlTransform } from 'react-markdown';
import type { PluggableList } from 'unified';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { visit } from 'unist-util-visit';
import Image from '../../embed-shims/next-image';
import { AlertCircleIcon } from '../icons-v2-generated';
import { cn } from '../../utils/cn';

// ---------------------------------------------------------------------------
// rehype HAST sanitizer — runs AFTER rehype-raw to strip XSS vectors
// ---------------------------------------------------------------------------
/**
 * Minimal HAST sanitizer. Runs AFTER `rehype-raw` (which parses raw HTML
 * embedded in markdown) and BEFORE `rehype-highlight`. Strips the
 * attack surfaces that rehype-raw leaves wide open:
 *
 *   - `on*` event handlers (onerror, onload, onclick, …) on ANY element
 *   - href / src / formaction / xlink:href / poster pointing at
 *     `javascript:` (case + whitespace tolerant)
 *   - `iframe srcdoc` (full-document XSS)
 *   - `<script>`, `<style>`, `<noscript>`, `<noembed>` elements (drop)
 *   - `data:` URIs on src-ish attrs (SVG-with-embedded-JS class of bug)
 *
 * Why custom (vs `rehype-sanitize`): the OSS-lib build environment
 * doesn't have `rehype-sanitize` in its `node_modules` (sandbox
 * restriction), but `unist-util-visit` is already a transitive dep of
 * `rehype-raw`. This plugin is ~60 lines, ships nothing new, and is
 * tighter than the default sanitize schema for our threat model
 * (we want LLM-emitted markdown to be safe; we don't need full HTML5
 * fidelity).
 *
 * The text-level `escapeUnknownHtmlTags` pre-pass below is still useful
 * for catching `<their>`-style accidental tag emissions that React 19
 * rejects, but it is NOT a security boundary. THIS is.
 */
const EVENT_HANDLER_ATTR_RE = /^on[a-z]+$/i
const JAVASCRIPT_URL_RE = /^[\s\x00-\x1f]*javascript:/i
const DATA_URL_RE = /^[\s\x00-\x1f]*data:/i
const URL_ATTRS = new Set([
  'href',
  'src',
  // `srcset` accepts `javascript:` on legacy browsers — same guard
  // as the canonical hast-util-sanitize default schema's attr set.
  // Multi-candidate scanning lives in `srcsetHasUnsafeCandidate` below;
  // a single-URL check would miss a malicious second candidate like
  // `"https://safe.png 1x, javascript:alert(1) 2x"`.
  'srcset',
  'formaction',
  'xlink:href',
  'poster',
  'data',
  'action',
  'background',
])

/**
 * Returns true if any candidate in an `srcset` attribute has a dangerous
 * URL scheme. Per the HTML spec, srcset is a comma-separated list of
 * candidates; each candidate is `<url> <descriptor>?` (e.g.
 * `"https://x/a.png 2x"`). The single-URL `JAVASCRIPT_URL_RE.test(v)`
 * check only inspects the FIRST candidate — so a malicious second
 * candidate (`"https://safe 1x, javascript:alert(1) 2x"`) would slip
 * through. This helper splits on `,`, trims each candidate, takes the
 * leading whitespace-delimited token (the URL), and tests that.
 *
 * Splitting on every comma over-matches the rare-in-practice case of
 * commas inside URL paths. That's the correct error bias for a
 * sanitizer: over-strip is safe, under-strip is not.
 */
function srcsetHasUnsafeCandidate(srcset: string): boolean {
  for (const candidate of srcset.split(',')) {
    const url = candidate.trim().split(/\s+/)[0] ?? ''
    if (JAVASCRIPT_URL_RE.test(url) || DATA_URL_RE.test(url)) return true
  }
  return false
}
// Element-level drop list. The text-pre-pass `escapeUnknownHtmlTags`
// already escapes any `<tag>` whose name isn't on its allow-list, so
// `<object>`, `<embed>`, `<applet>`, `<base>`, `<meta>` normally never
// reach `rehype-raw` as elements. Re-stripping at the HAST layer
// removes the cross-layer dependency: this sanitizer is sufficient
// on its own even if the text pre-pass is bypassed.
const STRIP_ELEMENTS = new Set([
  'script',
  'style',
  'noscript',
  'noembed',
  'object',
  'embed',
  'applet',
  'base',
  'meta',
])

function rehypeStripUnsafe() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (tree: any) => {
    visit(tree, 'element', (node: any, index: number | undefined, parent: any) => {
      const tag = String(node.tagName ?? '').toLowerCase()
      if (STRIP_ELEMENTS.has(tag)) {
        if (parent && typeof index === 'number') {
          parent.children.splice(index, 1)
          // Return the numeric index (`unist-util-visit` treats it as
          // `[CONTINUE, index]`) so the walker resumes at the slot the
          // removed node vacated. Don't return `[SKIP, index]`:
          // skip-descendants is meaningless for a node we just removed,
          // and SKIP+index conflates two signals.
          return index
        }
        // Root-level strip element (parent undefined). Rare, but
        // possible if `rehype-raw` ever lifts one. Neutralize in
        // place by clearing children + retagging as a blank span.
        node.children = []
        node.tagName = 'span'
        node.properties = {}
        return
      }
      if (!node.properties || typeof node.properties !== 'object') return
      for (const key of Object.keys(node.properties)) {
        // 1. event handlers
        if (EVENT_HANDLER_ATTR_RE.test(key)) {
          delete node.properties[key]
          continue
        }
        // 2. dangerous URL schemes on URL-bearing attrs. `srcset` is
        //    multi-candidate so it routes through `srcsetHasUnsafeCandidate`
        //    which inspects every URL in the list (not just the first).
        if (URL_ATTRS.has(key.toLowerCase())) {
          const raw = node.properties[key]
          const v = Array.isArray(raw) ? raw[0] : raw
          if (typeof v === 'string') {
            const unsafe =
              key.toLowerCase() === 'srcset'
                ? srcsetHasUnsafeCandidate(v)
                : JAVASCRIPT_URL_RE.test(v) || DATA_URL_RE.test(v)
            if (unsafe) {
              delete node.properties[key]
              continue
            }
          }
        }
        // 3. iframe srcdoc — full-document XSS vector
        if (tag === 'iframe' && key.toLowerCase() === 'srcdoc') {
          delete node.properties[key]
        }
      }
    })
  }
}

/**
 * URL transformer that extends react-markdown's default safe-protocol
 * allowlist with `card://` — the non-standard scheme `remarkCardLinks`
 * emits for inline chat-card markers.
 *
 * Without this, react-markdown 10's `defaultUrlTransform` strips the URL
 * to `""` before the `<a>` component override runs (the override's
 * `href.startsWith('card://')` check then fails and the marker leaks
 * through as literal text). All other URL schemes still go through the
 * default sanitizer — `javascript:`, `vbscript:`, `data:` (non-image), etc.
 * remain blocked.
 *
 * Scope: `card://` is allowed ONLY for `href` attributes. If the LLM
 * accidentally emits `![alt](card://type:id)` the URL still goes through
 * `defaultUrlTransform` (which strips it to `""`) so an `<img src="card://...">`
 * never reaches the DOM — broken request avoided. Per v6.1 §B.2.4: "the
 * `card://` scheme is internal — never network-fetched, never written to
 * attributes other than `href` for renderer dispatch."
 */
function cardAwareUrlTransform(url: string, key: string): string {
  if (key === 'href' && typeof url === 'string' && url.startsWith('card://')) return url;
  return defaultUrlTransform(url);
}

// ---------------------------------------------------------------------------
// LLM-output sanitizer — escape unknown HTML-style tags
// ---------------------------------------------------------------------------
/**
 * Tags `rehype-raw` is allowed to forward to React as-is. Anything
 * outside this set gets its angle brackets escaped so it renders as
 * plain text rather than reaching React as an unrecognized custom
 * element.
 *
 * Why this matters: chat output is LLM-generated markdown. An LLM that
 * accidentally wraps a word in angle brackets ("share <their> settings")
 * or echoes a system-prompt XML tag ("the <ticket> element above")
 * makes `rehype-raw` mint a `<their>` / `<ticket>` JSX element. React
 * 18 logs "tag is unrecognized in this browser" for every unknown tag;
 * React 19 throws on tags with reserved kebab-case forms. We pre-escape
 * to keep the renderer pristine without losing legitimate inline HTML
 * (details/summary, video, iframe, kbd, mark, etc.).
 *
 * The allow-list mirrors HTML5 + the elements the chat shell wires
 * component overrides for. Kept lower-case; matched case-insensitively.
 */
const SAFE_HTML_TAGS = new Set([
  // Block + inline text
  'a', 'abbr', 'address', 'article', 'aside', 'b', 'bdi', 'bdo', 'blockquote',
  'br', 'caption', 'cite', 'code', 'col', 'colgroup', 'data', 'dd', 'del',
  'details', 'dfn', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'footer',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'i', 'ins',
  'kbd', 'li', 'main', 'mark', 'nav', 'ol', 'p', 'pre', 'q', 'rp', 'rt',
  'ruby', 's', 'samp', 'section', 'small', 'span', 'strong', 'sub', 'summary',
  'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'time', 'tr', 'u',
  'ul', 'var', 'wbr',
  // Media
  'img', 'picture', 'source', 'audio', 'video', 'iframe', 'track',
  // Forms (rehype-raw allows them; mostly harmless for chat output)
  'button', 'input', 'label', 'select', 'option', 'optgroup', 'textarea', 'form', 'fieldset', 'legend',
])

/**
 * Match an opening / closing HTML tag in markdown source. Captures:
 *   1 — optional `/` for closing tags
 *   2 — tag name (must start with a letter)
 *   3 — everything between the name and the closing `>` (attrs etc.)
 *   4 — optional `/` for void-element self-close
 */
// ReDoS-safe shape: the tag-name class `[a-zA-Z0-9-]` and the rest
// class `[^>]` both match `-`, so two adjacent quantifiers over those
// classes (the prior `[a-zA-Z0-9-]*` + `[^>]*?`) admitted O(n²)
// backtracking on unterminated `<A-----...` strings (CodeQL flagged
// this as a polynomial-regex ReDoS). Anchoring the rest on a leading
// `\s` (which CANNOT match `-`) makes the boundary unambiguous —
// the engine can no longer redistribute dashes between captures, so
// matching is linear-time even on attacker-controlled markdown.
//
// Tag shapes still covered: `<a>`, `<a/>`, `<a class="x">`,
// `<a class="x"/>`, `</a>`, `<input type="text" />`. Whitespace
// between tag-name and attrs is required by the HTML spec
// (`<aclass>` is one token, not a tag), so anchoring on `\s` doesn't
// reject any valid HTML.
const TAG_LIKE_REGEX = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s[^>]*?)?)(\/?)>/g

function escapeUnknownHtmlTags(text: string): string {
  if (!text || text.indexOf('<') === -1) return text
  // Carve out fenced code blocks AND inline-backtick spans so we don't
  // corrupt `<their>` examples that legitimately live inside code. The
  // regex matches in priority order: triple-fence first (greediest),
  // then inline single-backtick. Each protected span is preserved
  // verbatim; everything between/around them runs through
  // `escapeOutsideFences`.
  const parts: string[] = []
  let cursor = 0
  // Triple-fence ``` … ```  OR  single-backtick `…` (one line, no
  // embedded newlines). Backtick group is non-greedy and forbids
  // inner newlines per CommonMark inline-code semantics.
  const PROTECTED_SPAN_RE = /```[\s\S]*?```|`[^`\n]+`/g
  let span: RegExpExecArray | null
  while ((span = PROTECTED_SPAN_RE.exec(text)) !== null) {
    if (span.index > cursor) {
      parts.push(escapeOutsideFences(text.slice(cursor, span.index)))
    }
    parts.push(span[0])
    cursor = span.index + span[0].length
  }
  if (cursor < text.length) {
    parts.push(escapeOutsideFences(text.slice(cursor)))
  }
  return parts.join('')
}

function escapeOutsideFences(segment: string): string {
  return segment.replace(TAG_LIKE_REGEX, (match, slash, tag, rest, selfClose) => {
    const lower = (tag as string).toLowerCase()
    if (SAFE_HTML_TAGS.has(lower)) return match
    // Unknown tag — escape so it renders as text instead of reaching
    // React as a custom element.
    return `&lt;${slash}${tag}${rest}${selfClose}&gt;`
  })
}

// ---------------------------------------------------------------------------
// Mermaid styles (responsive)
// ---------------------------------------------------------------------------
const mermaidStyles = `
  .mermaid-svg-container svg {
    max-width: 100% !important;
    height: auto !important;
    min-height: 200px;
    font-family: 'DM Sans', sans-serif !important;
    font-size: 14px !important;
  }
  @media (min-width: 1520px) {
    .mermaid-svg-container svg {
      max-width: 900px !important;
      max-height: 700px !important;
      min-height: 300px;
      font-size: 16px !important;
    }
  }
  @media (min-width: 768px) and (max-width: 1519px) {
    .mermaid-svg-container svg {
      max-width: 700px !important;
      max-height: 600px !important;
      min-height: 250px;
      font-size: 15px !important;
    }
  }
  @media (max-width: 767px) {
    .mermaid-svg-container svg {
      max-width: 90vw !important;
      max-height: 400px !important;
      min-height: 200px;
      font-size: 13px !important;
    }
  }
  .mermaid-svg-container svg[width] { width: 100% !important; }
  .mermaid-svg-container .node rect,
  .mermaid-svg-container .node circle,
  .mermaid-svg-container .node ellipse,
  .mermaid-svg-container .node polygon { stroke-width: 2px !important; }
  .mermaid-svg-container .edgePath path { stroke-width: 2px !important; }
  @media (min-width: 768px) {
    .mermaid-svg-container .node text,
    .mermaid-svg-container .edgeLabel text { font-size: 14px !important; }
  }
  @media (min-width: 1520px) {
    .mermaid-svg-container .node text,
    .mermaid-svg-container .edgeLabel text { font-size: 16px !important; }
  }
`;

// ---------------------------------------------------------------------------
// MermaidDiagram
// ---------------------------------------------------------------------------
const MermaidDiagram: React.FC<{ chart: string }> = ({ chart }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const renderMermaid = async () => {
      try {
        setIsLoading(true);
        // @ts-ignore -- mermaid is an optional runtime dependency, dynamically imported by the consumer
        const { default: mermaid } = await import('mermaid');

        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark' as const,
          themeVariables: {
            primaryColor: '#FFC008',
            primaryTextColor: '#FAFAFA',
            primaryBorderColor: '#3A3A3A',
            lineColor: '#888888',
            secondaryColor: '#212121',
            tertiaryColor: '#2A2A2A',
            background: 'transparent',
            mainBkg: 'transparent',
            secondBkg: 'transparent',
            tertiaryBkg: 'transparent',
            cScale0: '#FFC008', cScale1: '#4ECDC4', cScale2: '#45B7D1',
            cScale3: '#96CEB4', cScale4: '#FFEAA7', cScale5: '#DDA0DD',
            cScale6: '#98D8C8', cScale7: '#F7DC6F', cScale8: '#BB8FCE',
            cScale9: '#85C1E9',
            taskTextColor: '#FAFAFA',
            taskTextOutsideColor: '#FAFAFA',
            activeTaskTextColor: '#1A1A1A',
            nodeTextColor: '#FAFAFA',
          },
          flowchart: { useMaxWidth: true, htmlLabels: true, rankSpacing: 50, nodeSpacing: 30, curve: 'basis' },
          sequence: { useMaxWidth: true, width: 150 },
          pie: { useMaxWidth: true, useWidth: undefined },
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 14,
          securityLevel: 'loose',
        });

        const { svg: renderedSvg } = await mermaid.render(`mermaid-${Date.now()}`, chart);
        setSvg(renderedSvg);
        setIsLoading(false);
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError(`Failed to render diagram: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setIsLoading(false);
      }
    };

    if (mounted) { renderMermaid(); }
  }, [chart, mounted]);

  if (error) {
    return (
      <div className="error-state bg-ods-card border border-ods-border rounded-lg p-6 my-6">
        <div className="error-icon flex justify-center mb-4">
          <AlertCircleIcon className="w-12 h-12 text-ods-error" />
        </div>
        <div className="error-title text-center font-sans font-semibold text-lg text-ods-error mb-2">
          Diagram Error
        </div>
        <div className="error-description text-center font-sans text-sm text-ods-text-secondary mb-4 break-words overflow-hidden max-w-full">
          <div className="overflow-x-auto">
            <pre className="whitespace-pre-wrap break-words text-xs">{error}</pre>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !svg) {
    return (
      <div className="skeleton-code bg-ods-card border border-ods-border rounded-lg p-6 min-h-[120px] flex items-center justify-center">
        <div className="animate-pulse text-ods-text-tertiary font-sans">
          {isLoading ? 'Loading diagram renderer...' : 'Rendering diagram...'}
        </div>
      </div>
    );
  }

  return (
    <div className="mermaid-container rounded-lg p-4 md:p-6 lg:p-8 my-6 overflow-x-auto bg-ods-card border border-ods-border">
      <div className="flex justify-center items-center w-full min-h-[200px] md:min-h-[250px] lg:min-h-[300px]">
        <div
          className="mermaid-svg-container w-full flex justify-center max-w-full"
          style={{ fontSize: '14px' }}
          dangerouslySetInnerHTML={{
            __html: svg.replace(/<svg[^>]*>/, (match) =>
              match.replace(/width="[^"]*"/, 'width="100%"').replace(/height="[^"]*"/, 'height="auto"')
            ),
          }}
        />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Utility: extract plain text from React children
// ---------------------------------------------------------------------------
function extractText(node: any): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node?.props?.children) return extractText(node.props.children);
  return '';
}

// ---------------------------------------------------------------------------
// Text size configuration
// ---------------------------------------------------------------------------
export type TextSizeElement =
  | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  | 'p' | 'li' | 'blockquote' | 'code' | 'th' | 'td';

export type TextSizeClassMap = Partial<Record<TextSizeElement, string>>;
export type TextSizePreset = 'default' | 'compact' | 'large';
export type TextSizeConfig =
  | TextSizePreset
  | TextSizeClassMap
  | { preset: TextSizePreset; overrides: TextSizeClassMap };

const TEXT_SIZE_PRESETS: Record<TextSizePreset, Record<TextSizeElement, string>> = {
  default: {
    h1: 'text-heading-1',
    h2: 'text-heading-2',
    h3: 'text-2xl md:text-3xl',
    h4: 'text-xl',
    h5: 'text-lg md:text-xl',
    h6: 'text-base md:text-lg',
    p: 'md:text-h4 lg:text-h4',
    li: 'text-base md:text-lg',
    blockquote: 'text-lg',
    code: 'text-[14px]',
    th: 'text-xs md:text-sm',
    td: 'text-xs md:text-sm',
  },
  compact: {
    h1: 'text-heading-2',
    h2: 'text-heading-3',
    h3: 'text-xl md:text-2xl',
    h4: 'text-lg md:text-xl',
    h5: 'text-base md:text-lg',
    h6: 'text-sm md:text-base',
    p: 'text-base md:text-lg',
    li: 'text-base md:text-lg',
    blockquote: 'text-base md:text-lg',
    code: 'text-[13px]',
    th: 'text-xs md:text-sm',
    td: 'text-xs md:text-sm',
  },
  large: {
    h1: 'text-heading-1',
    h2: 'text-heading-1',
    h3: 'text-heading-2',
    h4: 'text-2xl md:text-3xl',
    h5: 'text-xl md:text-2xl',
    h6: 'text-lg md:text-xl',
    p: 'text-h3',
    li: 'text-lg md:text-xl',
    blockquote: 'text-xl md:text-2xl',
    code: 'text-[16px]',
    th: 'text-sm md:text-base',
    td: 'text-sm md:text-base',
  },
};

function resolveTextSizeConfig(config?: TextSizeConfig): Record<TextSizeElement, string> {
  const defaultSizes = TEXT_SIZE_PRESETS.default;
  if (!config) return defaultSizes;
  if (typeof config === 'string') return TEXT_SIZE_PRESETS[config];
  if ('preset' in config) return { ...TEXT_SIZE_PRESETS[config.preset], ...config.overrides };
  return { ...defaultSizes, ...config };
}

// ---------------------------------------------------------------------------
// Resolved link result used by onResolveLink callback
// ---------------------------------------------------------------------------
export interface ResolveLinkResult {
  success: boolean;
  resolvedPath?: string;
  type?: string;
  action?: string;
  error?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface SimpleMarkdownRendererProps {
  content: string;
  className?: string;
  /** Backend-provided heading IDs for deep-link anchors */
  sectionIds?: Array<{ id: string; title: string; level: number }>;
  /** When the page already has an H1, render markdown `#` as `<h2>` */
  demoteMarkdownH1ToH2?: boolean;
  /** List of broken link hrefs detected server-side (shown with [BROKEN] badge) */
  brokenLinks?: string[];
  /** Callback for internal (non-http, non-anchor) link clicks */
  onInternalLinkClick?: (path: string, options?: { expandFolder?: boolean; fromInternalLink?: boolean }) => void;
  /** Current documentation path — enables internal-link mode when set */
  currentPath?: string;
  /**
   * Resolve an internal link href to a navigation path.
   * Called when a user clicks an internal doc link.
   */
  onResolveLink?: (href: string, currentPath: string) => Promise<ResolveLinkResult>;
  /** Pre-process the raw markdown string before rendering (e.g. shortcode expansion) */
  preprocessContent?: (content: string) => string;
  /** Merge additional or override react-markdown component renderers */
  componentOverrides?: Partial<Components>;
  /**
   * Extra remark plugins appended after the built-in `remarkGfm` and
   * `remarkBreaks`. Used by chat consumers to inject `remarkCardLinks`,
   * which converts `[card://<type>:<id>]` markers into synthetic `link`
   * nodes; the host's `componentOverrides.a` then swaps those for whatever
   * inline entity-card component it provides.
   *
   * Each entry is either a Plugin reference or a [Plugin, options] tuple
   * — same shape as react-markdown's own `remarkPlugins` prop. Pass an
   * empty array (or omit) to keep the default plugin set.
   */
  additionalRemarkPlugins?: PluggableList;
  /**
   * Configure text sizing for all rendered elements.
   * - `"default"` — current behavior (large article-style typography)
   * - `"compact"` — smaller sizes for sidebars, cards, changelogs
   * - `"large"` — extra-large sizes for hero/landing content
   * - `{ p: "text-sm", h1: "text-2xl" }` — per-element overrides (merged onto default)
   * - `{ preset: "compact", overrides: { h1: "text-heading-1" } }` — preset + tweaks
   */
  textSize?: TextSizeConfig;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const SimpleMarkdownRenderer: React.FC<SimpleMarkdownRendererProps> = ({
  content,
  className = "",
  sectionIds,
  demoteMarkdownH1ToH2 = false,
  brokenLinks = [],
  onInternalLinkClick,
  currentPath: propCurrentPath,
  onResolveLink,
  preprocessContent,
  componentOverrides,
  textSize,
  additionalRemarkPlugins,
}) => {
  const idCountsRef = useRef<Record<string, number>>({});

  // ---- text sizes ----
  const textSizes = useMemo(() => resolveTextSizeConfig(textSize), [textSize]);

  // ---- section ID map ----
  const sectionIdMap = useMemo(() => {
    const map = new Map<string, string>();
    if (sectionIds) {
      sectionIds.forEach(section => {
        const cleanTitle = section.title
          .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
          .trim()
          .toLowerCase();
        map.set(section.title.toLowerCase(), section.id);
        map.set(cleanTitle, section.id);
        map.set(section.title, section.id);
      });
    }
    return map;
  }, [sectionIds]);

  // ---- heading ID generation ----
  const generateHeadingId = useCallback((text: string, level: number): string => {
    if (sectionIds && (level === 1 || level === 2)) {
      const variations = [
        text, text.toLowerCase(),
        text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim(),
        text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim().toLowerCase(),
      ];
      for (const v of variations) {
        const id = sectionIdMap.get(v);
        if (id) return id;
      }
    }
    const baseId = text
      .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
      .trim().toLowerCase()
      .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/^-+|-+$/g, '');
    const cleanId = baseId || `section-${Object.keys(idCountsRef.current).length + 1}`;
    if (idCountsRef.current[cleanId]) {
      idCountsRef.current[cleanId]++;
      return `${cleanId}-${idCountsRef.current[cleanId]}`;
    }
    idCountsRef.current[cleanId] = 1;
    return cleanId;
  }, [sectionIds, sectionIdMap]);

  // ---- preprocess ----
  // Run the optional caller-supplied transform first, then defensively
  // escape unknown HTML-style tags so an LLM that wrote `<their>` or
  // accidentally echoed a system-prompt XML tag like `<ticket>` doesn't
  // make `rehype-raw` hand React an unrecognized custom element (which
  // logs a noisy "tag is unrecognized in this browser" warning AND can
  // crash the SimpleMarkdownRenderer when the tag has a kebab-case
  // form React rejects outright). Allow-listed tags pass through
  // unchanged so legitimate inline HTML (details/summary, video,
  // iframe, etc.) still renders.
  const processedContent = useMemo(
    () => escapeUnknownHtmlTags(preprocessContent ? preprocessContent(content) : content),
    [preprocessContent, content],
  );

  // ---- heading factory ----
  const makeHeading = useCallback(
    (Tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6', level: number, headingClassName: string) =>
      ({ children }: any) => {
        const text = extractText(children);
        const effectiveLevel = Tag === 'h1' && demoteMarkdownH1ToH2 ? 2 : level;
        const id = generateHeadingId(text, effectiveLevel);
        const EffectiveTag = Tag === 'h1' && demoteMarkdownH1ToH2 ? 'h2' : Tag;
        return <EffectiveTag id={id} className={headingClassName}>{children}</EffectiveTag>;
      },
    [generateHeadingId, demoteMarkdownH1ToH2],
  );

  // ---- components ----
  const components: Components = useMemo(() => ({
    // --- code ---
    code: ({ node, inline, className: codeClassName, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(codeClassName || '');
      const language = match ? match[1] : '';

      if (!inline && language === 'mermaid') {
        return <MermaidDiagram chart={String(children).replace(/\n$/, '')} />;
      }

      if (!inline && match) {
        return (
          <div className="code-block-container border rounded-lg my-6 overflow-hidden bg-ods-card border-ods-border">
            <div className="code-header border-b px-4 py-2 bg-ods-card border-ods-border">
              <span className="font-sans text-xs uppercase tracking-wide text-ods-text-tertiary">
                {language || 'code'}
              </span>
            </div>
            <div className="p-4">
              <pre className="overflow-x-auto">
                <code
                  className={cn(`language-${language} hljs`, textSizes.code)}
                  style={{
                    fontFamily: "JetBrains Mono', 'SF Mono', Consolas, monospace",
                    background: 'transparent',
                    color: 'var(--ods-text-primary)',
                  }}
                  {...props}
                >
                  {children}
                </code>
              </pre>
            </div>
          </div>
        );
      }

      return (
        <code className="font-mono text-[0.9em] px-1.5 py-0.5 rounded border bg-ods-card text-ods-text-primary border-ods-border" {...props}>
          {children}
        </code>
      );
    },

    // --- div (pass-through, overridable for embeds) ---
    div: ({ node, className: divClassName, children, ...props }: any) => (
      <div className={divClassName} {...props}>{children}</div>
    ),

    // --- blockquote ---
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-ods-accent ml-0 pl-6 my-8 py-4 rounded-r-lg bg-ods-bg-secondary">
        <div className={cn('font-sans leading-relaxed text-ods-text-secondary', textSizes.blockquote)}>
          {children}
        </div>
      </blockquote>
    ),

    // --- headings ---
    h1: makeHeading('h1', 1, cn('font-sans font-bold mt-8 mb-4 first:mt-0 text-ods-text-primary', textSizes.h1)),
    h2: makeHeading('h2', 2, cn('font-sans font-semibold mt-8 mb-4 pb-2 border-b text-ods-text-primary border-ods-border', textSizes.h2)),
    h3: makeHeading('h3', 3, cn('font-sans font-semibold mt-6 mb-3 text-ods-text-primary', textSizes.h3)),
    h4: makeHeading('h4', 4, cn('font-sans font-semibold mt-4 mb-2 text-ods-text-primary', textSizes.h4)),
    h5: makeHeading('h5', 5, cn('font-sans font-semibold mt-3 mb-2 text-ods-text-primary', textSizes.h5)),
    h6: makeHeading('h6', 6, cn('font-sans font-semibold mt-3 mb-1 text-ods-text-primary', textSizes.h6)),

    // --- paragraph ---
    p: ({ children }: any) => (
      <p className={cn('leading-relaxed mb-4 first:mt-0 last:mb-0 text-ods-text-primary', textSizes.p)}>
        {children}
      </p>
    ),

    // --- links ---
    a: ({ href, children, className: linkClassName }: any) => {
      const isBroken = brokenLinks.includes(href);
      const isInternalDocLink =
        propCurrentPath !== undefined &&
        propCurrentPath !== null &&
        href &&
        !href.startsWith('http') &&
        !href.startsWith('#');

      if (isBroken) {
        return (
          <span className="text-ods-accent cursor-not-allowed">
            {children}
            <sup className="ml-1 text-xs font-bold text-ods-attention-red-error">[BROKEN]</sup>
          </span>
        );
      }

      if (isInternalDocLink && onInternalLinkClick) {
        const currentPath = propCurrentPath ?? '';
        return (
          <span
            className="text-ods-accent no-underline relative transition-colors duration-200 hover:after:w-full after:content-[''] after:absolute after:w-0 after:h-0.5 after:-bottom-0.5 after:left-0 after:bg-ods-accent after:transition-all after:duration-300 cursor-pointer"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onResolveLink) {
                try {
                  const result = await onResolveLink(href, currentPath);
                  if (result.type === 'folder-no-readme' && result.action === 'expand_folder') {
                    onInternalLinkClick(result.resolvedPath!, { expandFolder: true, fromInternalLink: true });
                  } else if (result.type === 'not-found') {
                    return;
                  } else if (result.success && result.resolvedPath) {
                    onInternalLinkClick(result.resolvedPath, { fromInternalLink: true });
                  }
                } catch (error) {
                  console.error('Error resolving link:', error);
                }
              } else {
                onInternalLinkClick(href, { fromInternalLink: true });
              }
            }}
            role="link"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                (e.currentTarget as HTMLElement).click();
              }
            }}
          >
            {children}
          </span>
        );
      }

      return (
        <a
          href={href}
          className={`text-ods-accent no-underline relative transition-colors duration-200 hover:after:w-full after:content-[''] after:absolute after:w-0 after:h-0.5 after:-bottom-0.5 after:left-0 after:bg-ods-accent after:transition-all after:duration-300 ${linkClassName || ''}`}
          target={href?.startsWith('http') ? '_blank' : undefined}
          rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
        >
          {children}
        </a>
      );
    },

    // --- images ---
    // Inline content image renderer. Used by blog posts, docs, AND chat
    // messages (where users may attach screenshots / photos via the +
    // attachment button).
    //
    // Sizing rules (2025-2026 best practice — Claude.ai, ChatGPT,
    // iMessage, Slack, Discord inline image patterns):
    //
    //   - CAP max-width at 400px so inline images don't blow out the
    //     message column on wide panels. Click-to-expand opens a
    //     full-resolution modal for users who need detail.
    //   - CAP max-height at 400px so portrait-orientation images
    //     don't dominate vertical space (a 1000x3000 phone screenshot
    //     would otherwise push the next message off-screen).
    //   - Small images render at NATURAL pixel size — a 64x64
    //     thumbnail stays 64x64, not stretched to fill the column.
    //   - `object-contain` preserves aspect ratio when both dimensions
    //     are constrained (long landscape, tall portrait).
    //
    // Implementation: Next.js `<Image>` — the project's canonical
    // image primitive. Gives us:
    //   - WebP/AVIF format conversion for modern browsers (smaller
    //     bytes for the same visual quality).
    //   - Responsive `srcset` via the `sizes` prop (browser picks the
    //     right variant for the viewport).
    //   - Automatic lazy-loading (`loading="lazy"` by default, mid-
    //     page images skipped until they near the viewport).
    //   - Automatic `decoding="async"` so image decode doesn't block
    //     paint.
    //
    // `width={400} height={400}` props are REQUIRED by Next.js
    // `<Image>` (non-`fill` mode throws without them) but they're
    // effectively a CEILING here, not the display size — the CSS
    // overrides (`w-auto h-auto max-w-full max-h-[400px]`) drive
    // the actual rendered size. The inline `style={{ width: 'auto',
    // height: 'auto' }}` is belt-and-suspenders: Next.js Image sets
    // matching HTML `width`/`height` attributes on the rendered
    // `<img>` and inline style wins over both HTML attributes AND
    // utility classes regardless of CSS-specificity surprises.
    //
    // Layout reservation trade-off: until image bytes arrive, the
    // browser may reserve a placeholder box up to 400x400 (the props'
    // intrinsic-ratio hint). Once loaded, the box collapses to the
    // natural size if smaller. This is the standard Next.js Image
    // behavior across the codebase — accepted for the optimizer +
    // responsive-srcset benefits. Chat attachments hosted in side
    // panels see this only on first render of a fresh attachment
    // (cached re-renders pop in without a perceptible shift).
    img: ({ src, alt }: any) => {
      if (!src || typeof src !== 'string' || src.trim() === '') return null;
      return (
        <Image
          src={src}
          alt={alt ?? 'No image available'}
          width={400}
          height={400}
          sizes="(max-width: 400px) 100vw, 400px"
          className="max-w-full max-h-[400px] w-auto h-auto rounded-lg object-contain"
          style={{ width: 'auto', height: 'auto' }}
        />
      );
    },

    // --- lists ---
    ul: ({ children }: any) => (
      <ul className="list-disc list-outside my-4 ml-8 space-y-2 text-ods-text-primary">{children}</ul>
    ),
    ol: ({ children }: any) => (
      <ol className="list-decimal list-outside my-4 ml-8 space-y-2 text-ods-text-primary">{children}</ol>
    ),
    li: ({ children }: any) => (
      <li className={cn('leading-relaxed pl-2', textSizes.li)}>{children}</li>
    ),

    // --- tables ---
    table: ({ children }: any) => (
      <div className="table-container my-6 overflow-x-auto">
        <div className="min-w-full border rounded-lg border-ods-border bg-ods-card">
          <table className="w-full table-fixed md:table-auto">{children}</table>
        </div>
      </div>
    ),
    thead: ({ children }: any) => (
      <thead className="bg-ods-bg-secondary">{children}</thead>
    ),
    th: ({ children }: any) => (
      <th className={cn('px-2 md:px-4 py-3 text-left font-semibold text-ods-accent border-r last:border-r-0 break-words border-ods-border', textSizes.th)}>
        {children}
      </th>
    ),
    td: ({ children }: any) => (
      <td className={cn('px-2 md:px-4 py-3 border-r last:border-r-0 border-b break-words whitespace-normal text-ods-text-primary border-ods-border', textSizes.td)}>
        {children}
      </td>
    ),

    // --- horizontal rule ---
    hr: () => <hr className="border-0 border-t my-8 border-ods-border" />,

    // --- merge overrides ---
    ...componentOverrides,
  }), [makeHeading, brokenLinks, propCurrentPath, onInternalLinkClick, onResolveLink, componentOverrides, textSizes]);

  return (
    <div className={`simple-markdown-renderer ${className}`}>
      <style dangerouslySetInnerHTML={{ __html: mermaidStyles }} />
      <div className="content-wrapper max-w-none break-words">
        <article className="prose prose-lg max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkBreaks, ...(additionalRemarkPlugins ?? [])]}
            rehypePlugins={[
              // ORDER MATTERS: rehype-raw parses the raw HTML embedded
              // in the source markdown into HAST nodes; rehypeStripUnsafe
              // then walks the HAST tree and drops XSS vectors (on*
              // event handlers, javascript: URLs, script/style/iframe-srcdoc,
              // data: URIs). Reversing the order would have nothing to
              // sanitize (raw HTML would still be strings).
              rehypeRaw,
              rehypeStripUnsafe,
              [rehypeHighlight, { detect: true, ignoreMissing: true }],
            ]}
            urlTransform={cardAwareUrlTransform}
            components={components}
          >
            {processedContent}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  );
};

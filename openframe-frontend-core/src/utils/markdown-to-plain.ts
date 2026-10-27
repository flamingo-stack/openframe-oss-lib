/**
 * Convert markdown source to plain text. Used by both the SEO server component
 * (article-body echo in JSON-LD) and chat entity-card preview (clamped previews
 * inside chat cards).
 *
 * The text is what a reader of the rendered page reads: the markdown goes through the SAME steps
 * the renderer's pipeline runs (`components/ui/markdown/engine.tsx`: remark with GFM and line
 * breaks, then rehype with raw HTML), and the result is the `innerText` of that HTML
 * (`hast-util-to-text`). So link, emphasis and heading syntax, raw HTML tags (`<a rel>`, `<div>`),
 * escapes (`\<`) and entities (`&amp;`) all come out as their text; script and style content and
 * comments do not. Code blocks and images are left out: their content is not prose.
 *
 * The steps are unified's UTILITY functions, the ones those plugins wrap (`mdast-util-from-markdown`
 * with the GFM extensions, `mdast-util-newline-to-break`, `mdast-util-to-hast`, `hast-util-raw`),
 * not a `remark()` processor. This module is in the CommonJS builds, and a unified processor is a
 * callable object without `Function.prototype`: the bundler compiles a call to an imported
 * function as `.call(void 0)`, which a processor does not have (0.0.745 crashed on load:
 * `_remark.remark.call is not a function`). Plain functions have no such limit, and one
 * synchronous conversion needs no plugin system.
 *
 * The two consumers differ only in whitespace — `mode: 'article'` keeps paragraph breaks;
 * `mode: 'preview'` collapses everything to a single line.
 */
import type { Element, Root } from 'hast';
import { raw } from 'hast-util-raw';
import { toText } from 'hast-util-to-text';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { newlineToBreak } from 'mdast-util-newline-to-break';
import { toHast } from 'mdast-util-to-hast';
import { gfm } from 'micromark-extension-gfm';
import { SKIP, visit } from 'unist-util-visit';

export interface MarkdownToPlainOptions {
  /**
   * - `'article'` (default): preserve paragraph structure (`\n\n` as separator),
   *   strip code blocks + images + headings + list bullets. Used for the
   *   article-body echo on SEO surfaces.
   * - `'preview'`: collapse all whitespace to single spaces; result is a single
   *   line. Used for chat-card previews / OG-card snippets where line breaks
   *   would wrap awkwardly.
   */
  mode?: 'article' | 'preview';
  /** Optional max-character cap. Truncates with no ellipsis (caller-decided). */
  maxChars?: number;
}

/** Strip inline markdown markers (bold, italic, inline-code, links) from ONE line of text.
 *  Shared by `extractSections`'s `stripFormattingMarkers` and the heading ids, whose output is
 *  an anchor: it stays a fixed, regex-only rule so no heading id ever moves. */
export function stripInlineMarkdown(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) → text
    .replace(/\*\*([^*]+)\*\*/g, '$1') // **bold** → bold
    .replace(/\*([^*]+)\*/g, '$1') // *italic* → italic
    .replace(/`([^`]+)`/g, '$1'); // `inline code` → inline code
}

/** Elements whose content is not prose: code blocks and images. */
const NOT_PROSE = new Set(['pre', 'img']);

const TABLE_SECTIONS = new Set(['thead', 'tbody', 'tfoot']);

const element = (tagName: string, children: Element['children']): Element => ({
  type: 'element',
  tagName,
  properties: {},
  children,
});

/** Whether `toText` already breaks between a table's sections (current `hast-util-to-text` does; an older one ran
 *  the header row into the first body row). Asked once, of a one-cell header over a one-cell body. */
let sectionsBreak: boolean | undefined;
function toTextBreaksBetweenSections(): boolean {
  if (sectionsBreak === undefined) {
    const row = (text: string) => element('tr', [element('td', [{ type: 'text', value: text }])]);
    const table = element('table', [element('thead', [row('a')]), element('tbody', [row('b')])]);
    sectionsBreak = toText({ type: 'root', children: [table] }).includes('\n');
  }
  return sectionsBreak;
}

/** The renderer's steps, as functions: markdown (GFM) → line breaks → HTML tree with raw HTML parsed. */
function htmlTree(markdown: string): Root {
  const mdast = fromMarkdown(markdown, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
  newlineToBreak(mdast);
  return raw(toHast(mdast, { allowDangerousHtml: true })) as Root;
}

function proseTree(markdown: string): Root {
  const tree = htmlTree(markdown);
  visit(tree, 'element', (node: Element, index, parent) => {
    if (NOT_PROSE.has(node.tagName) && parent && index !== undefined) {
      parent.children.splice(index, 1);
      return [SKIP, index];
    }
    // An older `innerText` broke between rows of the same `thead` / `tbody` only, so the last header
    // row ran into the first body row ("What it buysEnthusiast"). There, a section followed by
    // another ends its last row with a line break; a current one breaks there itself.
    if (TABLE_SECTIONS.has(node.tagName) && parent && index !== undefined && !toTextBreaksBetweenSections()) {
      const followedBySection = parent.children
        .slice(index + 1)
        .some(sibling => sibling.type === 'element' && TABLE_SECTIONS.has(sibling.tagName));
      const rows = node.children.filter(
        (child): child is Element => child.type === 'element' && child.tagName === 'tr',
      );
      const lastRow = rows[rows.length - 1];
      if (followedBySection && lastRow) {
        lastRow.children.push({ type: 'element', tagName: 'br', properties: {}, children: [] });
      }
    }
    return undefined;
  });
  return tree;
}

export function markdownToPlainText(markdown: string, options: MarkdownToPlainOptions = {}): string {
  const { mode = 'article', maxChars } = options;

  let out = toText(proseTree(markdown));

  if (mode === 'preview') {
    out = out.replace(/\s+/g, ' ').trim();
  } else {
    out = out
      // No spaces around a line break (a soft break keeps the space that followed it).
      .replace(/[^\S\n]*\n[^\S\n]*/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  if (maxChars != null && out.length > maxChars) {
    out = out.slice(0, maxChars);
  }
  return out;
}

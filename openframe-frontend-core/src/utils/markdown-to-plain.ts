/**
 * Convert markdown source to plain text. Used by both the SEO server component
 * (article-body echo in JSON-LD) and chat entity-card preview (clamped previews
 * inside chat cards).
 *
 * The text is what a reader of the rendered page reads: the markdown is parsed with the SAME
 * pipeline the renderer uses (remark with GFM and line breaks, then rehype with raw HTML, as in
 * `components/ui/markdown/engine.tsx`), and the result is the `innerText` of that HTML
 * (`hast-util-to-text`). So link, emphasis and heading syntax, raw HTML tags (`<a rel>`, `<div>`),
 * escapes (`\<`) and entities (`&amp;`) all come out as their text; script and style content and
 * comments do not. Code blocks and images are left out: their content is not prose.
 *
 * The two consumers differ only in whitespace — `mode: 'article'` keeps paragraph breaks;
 * `mode: 'preview'` collapses everything to a single line.
 */
import type { Element, Root } from 'hast';
import { toText } from 'hast-util-to-text';
import rehypeRaw from 'rehype-raw';
import { remark } from 'remark';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
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

// The renderer's own pipeline, up to the HTML tree. Built once; `runSync` has no async plugins.
const toHtmlTree = remark()
  .use(remarkGfm)
  .use(remarkBreaks)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw);

/** Elements whose content is not prose: code blocks and images. */
const NOT_PROSE = new Set(['pre', 'img']);

const TABLE_SECTIONS = new Set(['thead', 'tbody', 'tfoot']);

function proseTree(markdown: string): Root {
  const tree: Root = toHtmlTree.runSync(toHtmlTree.parse(markdown));
  visit(tree, 'element', (node: Element, index, parent) => {
    if (NOT_PROSE.has(node.tagName) && parent && index !== undefined) {
      parent.children.splice(index, 1);
      return [SKIP, index];
    }
    // `innerText` breaks between rows of the same `thead` / `tbody` only, so the last header row
    // ran into the first body row ("What it buysEnthusiast"). A section followed by another ends
    // its last row with a line break.
    if (TABLE_SECTIONS.has(node.tagName) && parent && index !== undefined) {
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
